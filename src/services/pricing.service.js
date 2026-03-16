
import db from "../config/db.js";

const pricingService = {
    /**
     * Calculate dynamic price for a package based on travel date and coast type.
     * Uses the seasonal_pricing_rules table to apply percentage multipliers.
     * 
     * @param {Object} pkg - Package object (must contain base_price, coast_type)
     * @param {string|Date} travelDate - Date of travel
     * @param {number} adults - Number of adult travelers
     * @param {number} children - Number of child travelers
     * @returns {Object} Pricing breakdown
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
     * Get all active pricing rules
     */
    getAllRules: async () => {
        const result = await db.query(
            'SELECT * FROM seasonal_pricing_rules ORDER BY start_month, start_day'
        );
        return result.rows;
    }
};

export default pricingService;
