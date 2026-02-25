
import db from "../config/db.js";

const pricingService = {
    /**
     * Calculate dynamic price for a package based on travel date and coast type
     * @param {Object} pkg - Package object (must contain base_price, coast_type, season_type)
     * @param {string|Date} travelDate - Date of travel
     * @param {number} travelers - Number of travelers
     * @returns {Object} Pricing breakdown
     */
    calculateDynamicPrice: async (pkg, travelDate, adults = 1, children = 0) => {
        try {
            const date = new Date(travelDate);
            const totalTravelers = parseInt(adults) + parseInt(children);

            // Default values
            let multiplier = 1.0;
            let seasonLabel = 'Standard';
            let appliedRuleId = null;

            // 1. Determine Seasonal Multiplier
            if (pkg.season_type === 'year_round') {
                seasonLabel = 'Year Round';
            } else {
                const formattedDate = date.toISOString().split('T')[0];
                const ruleQuery = await db.query(`
                    SELECT * FROM seasonal_pricing_rules 
                    WHERE $1 BETWEEN start_date AND end_date
                    AND (applicable_coast = 'all' OR applicable_coast = $2)
                    ORDER BY 
                        CASE WHEN applicable_coast = $2 THEN 1 ELSE 2 END, 
                        percentage_multiplier DESC 
                    LIMIT 1
                `, [formattedDate, pkg.coast_type || 'mixed']);

                if (ruleQuery.rows.length > 0) {
                    const rule = ruleQuery.rows[0];
                    multiplier = parseFloat(rule.percentage_multiplier);
                    seasonLabel = rule.season_name.charAt(0).toUpperCase() + rule.season_name.slice(1);
                    appliedRuleId = rule.id;
                }
            }

            // 2. Calculate Prices
            const basePrice = parseFloat(pkg.base_price);

            // Adult Price: Base * Multiplier
            const adultPrice = basePrice * multiplier;

            // Child Price: 50% of Adult Price
            const childPrice = adultPrice * 0.5;

            // Total Price
            const totalAdultCost = adultPrice * parseInt(adults);
            const totalChildCost = childPrice * parseInt(children);
            const GRAND_TOTAL = totalAdultCost + totalChildCost;

            return {
                basePrice: basePrice,
                adultPrice: parseFloat(adultPrice.toFixed(2)),
                childPrice: parseFloat(childPrice.toFixed(2)),
                totalPrice: parseFloat(GRAND_TOTAL.toFixed(2)),
                adults: parseInt(adults),
                children: parseInt(children),
                totalTravelers,
                seasonLabel,
                multiplier,
                appliedRuleId
            };

        } catch (error) {
            console.error("Error in calculateDynamicPrice:", error);
            throw error;
        }
    },

    /**
     * Get all pricing rules (for Admin)
     */
    getAllRules: async () => {
        const result = await db.query('SELECT * FROM seasonal_pricing_rules ORDER BY start_date');
        return result.rows;
    }
};

export default pricingService;
