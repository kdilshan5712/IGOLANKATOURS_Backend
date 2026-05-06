import db from "../config/db.js";

/**
 * Pricing Service
 * Handles business logic for dynamic pricing calculations based on seasonal rules and geographic factors.
 */
const pricingService = {
    /**
     * Calculates the dynamic price for a tour package based on the travel date, group composition, and coast type.
     * Consults the 'seasonal_pricing_rules' database table to apply multipliers for high/low seasons.
     * 
     * @async
     * @function calculateDynamicPrice
     * @param {Object} pkg - The package object containing base_price and coast_type.
     * @param {string|Date} travelDate - The planned date for the tour.
     * @param {number} [adults=1] - Number of adult travelers.
     * @param {number} [children=0] - Number of child travelers (charged at 50% of adult rate).
     * @returns {Promise<Object>} A detailed pricing breakdown including total, per-traveler costs, and applied rules.
     */
    calculateDynamicPrice: async (pkg, travelDate, adults = 1, children = 0) => {
        try {
            const date = new Date(travelDate);
            const month = date.getMonth() + 1; // 1-12
            const day = date.getDate();        // 1-31

            let percentageAdjustment = 0;
            let seasonLabel = 'Standard Rate';
            let appliedRuleId = null;

            // Find the most specific active rule for this travel date and coast type
            // Handles rules that wrap across year end (e.g. Dec 1 – Jan 31)
            const ruleQuery = await db.query(`
                SELECT * FROM seasonal_pricing_rules
                WHERE is_active = TRUE
                AND (coast_type = 'all' OR coast_type = $3)
                AND (
                    -- Normal range (start <= end month)
                    (start_month < end_month 
                        OR (start_month = end_month AND start_day <= end_day))
                    AND (
                        ($1 > start_month OR ($1 = start_month AND $2 >= start_day))
                        AND ($1 < end_month OR ($1 = end_month AND $2 <= end_day))
                    )
                    OR
                    -- Wrap-around range (e.g. Dec -> Jan)
                    (start_month > end_month
                        OR (start_month = end_month AND start_day > end_day))
                    AND (
                        ($1 > start_month OR ($1 = start_month AND $2 >= start_day))
                        OR ($1 < end_month OR ($1 = end_month AND $2 <= end_day))
                    )
                )
                ORDER BY
                    CASE WHEN coast_type = $3 THEN 1 ELSE 2 END,
                    ABS(percentage) DESC
                LIMIT 1
            `, [month, day, pkg.coast_type || 'all']);

            if (ruleQuery.rows.length > 0) {
                const rule = ruleQuery.rows[0];
                percentageAdjustment = parseFloat(rule.percentage);
                seasonLabel = rule.name;
                appliedRuleId = rule.rule_id;
            }

            // Calculate prices
            const basePrice = parseFloat(pkg.base_price);
            const multiplier = 1 + (percentageAdjustment / 100);
            const adultPrice = basePrice * multiplier;
            const childPrice = adultPrice * 0.5; // Children are 50% of adult price

            const totalAdultCost = adultPrice * parseInt(adults);
            const totalChildCost = childPrice * parseInt(children);
            const totalPrice = totalAdultCost + totalChildCost;
            const totalTravelers = parseInt(adults) + parseInt(children);

            return {
                basePrice: parseFloat(basePrice.toFixed(2)),
                adultPrice: parseFloat(adultPrice.toFixed(2)),
                childPrice: parseFloat(childPrice.toFixed(2)),
                totalPrice: parseFloat(totalPrice.toFixed(2)),
                adults: parseInt(adults),
                children: parseInt(children),
                totalTravelers,
                seasonLabel,
                percentageAdjustment,
                multiplier: parseFloat(multiplier.toFixed(4)),
                appliedRuleId
            };

        } catch (error) {
            console.error("Error in calculateDynamicPrice:", error.message);
            // Fallback: return base price with no adjustment
            const basePrice = parseFloat(pkg.base_price || 0);
            const adultPrice = basePrice;
            const childPrice = adultPrice * 0.5;
            const totalPrice = adultPrice * parseInt(adults) + childPrice * parseInt(children);
            return {
                basePrice,
                adultPrice,
                childPrice,
                totalPrice: parseFloat(totalPrice.toFixed(2)),
                adults: parseInt(adults),
                children: parseInt(children),
                totalTravelers: parseInt(adults) + parseInt(children),
                seasonLabel: 'Standard Rate',
                percentageAdjustment: 0,
                multiplier: 1.0,
                appliedRuleId: null
            };
        }
    },

    /**
     * Retrieves all active seasonal pricing rules from the database.
     * 
     * @async
     * @function getAllRules
     * @returns {Promise<Array<Object>>} A list of all pricing rules.
     */
    getAllRules: async () => {
        const result = await db.query(
            'SELECT * FROM seasonal_pricing_rules ORDER BY start_month, start_day'
        );
        return result.rows;
    },

    /**
     * Synchronous pricing calculation using a pre-fetched rules array.
     * Eliminates the need for a DB query per package when pricing a list.
     * Used by getAllPackages to avoid N+1 database calls.
     *
     * @function calculateDynamicPriceSync
     * @param {Object} pkg - Package with base_price and coast_type.
     * @param {string|Date} travelDate - The travel date to price for.
     * @param {Array<Object>} rules - Pre-fetched active pricing rules from getAllRules().
     * @param {number} [adults=1] - Number of adult travelers.
     * @param {number} [children=0] - Number of child travelers.
     * @returns {Object} Pricing breakdown identical to calculateDynamicPrice.
     */
    calculateDynamicPriceSync: (pkg, travelDate, rules = [], adults = 1, children = 0) => {
        try {
            const date = new Date(travelDate);
            const month = date.getMonth() + 1; // 1-12
            const day = date.getDate();        // 1-31
            const coastType = pkg.coast_type || 'all';

            let percentageAdjustment = 0;
            let seasonLabel = 'Standard Rate';
            let appliedRuleId = null;

            // Filter and find the most specific matching active rule in JS
            const activeRules = rules.filter(r => r.is_active && (r.coast_type === 'all' || r.coast_type === coastType));

            const matchingRule = activeRules
                .filter(r => {
                    const sm = r.start_month, sd = r.start_day, em = r.end_month, ed = r.end_day;
                    const isNormal = sm < em || (sm === em && sd <= ed);
                    if (isNormal) {
                        return (month > sm || (month === sm && day >= sd)) &&
                               (month < em || (month === em && day <= ed));
                    } else {
                        // Wrap-around range (e.g. Dec -> Jan)
                        return (month > sm || (month === sm && day >= sd)) ||
                               (month < em || (month === em && day <= ed));
                    }
                })
                // Prefer coast-specific rules, then highest magnitude
                .sort((a, b) => {
                    if (a.coast_type === coastType && b.coast_type !== coastType) return -1;
                    if (b.coast_type === coastType && a.coast_type !== coastType) return 1;
                    return Math.abs(b.percentage) - Math.abs(a.percentage);
                })[0];

            if (matchingRule) {
                percentageAdjustment = parseFloat(matchingRule.percentage);
                seasonLabel = matchingRule.name;
                appliedRuleId = matchingRule.rule_id;
            }

            const basePrice = parseFloat(pkg.base_price);
            const multiplier = 1 + (percentageAdjustment / 100);
            const adultPrice = basePrice * multiplier;
            const childPrice = adultPrice * 0.5;

            const totalAdultCost = adultPrice * parseInt(adults);
            const totalChildCost = childPrice * parseInt(children);
            const totalPrice = totalAdultCost + totalChildCost;
            const totalTravelers = parseInt(adults) + parseInt(children);

            return {
                basePrice: parseFloat(basePrice.toFixed(2)),
                adultPrice: parseFloat(adultPrice.toFixed(2)),
                childPrice: parseFloat(childPrice.toFixed(2)),
                totalPrice: parseFloat(totalPrice.toFixed(2)),
                adults: parseInt(adults),
                children: parseInt(children),
                totalTravelers,
                seasonLabel,
                percentageAdjustment,
                multiplier: parseFloat(multiplier.toFixed(4)),
                appliedRuleId,
                pricePerPerson: parseFloat(adultPrice.toFixed(2)),
            };
        } catch (error) {
            console.error("Error in calculateDynamicPriceSync:", error.message);
            const basePrice = parseFloat(pkg.base_price || 0);
            return {
                basePrice,
                adultPrice: basePrice,
                childPrice: basePrice * 0.5,
                totalPrice: basePrice * parseInt(adults) + basePrice * 0.5 * parseInt(children),
                adults: parseInt(adults),
                children: parseInt(children),
                totalTravelers: parseInt(adults) + parseInt(children),
                seasonLabel: 'Standard Rate',
                percentageAdjustment: 0,
                multiplier: 1.0,
                appliedRuleId: null,
                pricePerPerson: basePrice,
            };
        }
    },
};

export default pricingService;
