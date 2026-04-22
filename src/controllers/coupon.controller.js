import db from "../config/db.js";

/**
 * Validates a coupon code against a booking amount.
 * Checks for activity, expiry, usage limits, and minimum booking requirements.
 * Calculates the applicable discount based on percentage or fixed value.
 * 
 * @async
 * @function validateCoupon
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} req.query.code - The coupon code to validate.
 * @param {number} [req.query.amount=0] - The booking amount to apply the coupon to.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the validation result and calculated discount.
 */
export const validateCoupon = async (req, res) => {
    try {
        const { code, amount } = req.query;

        if (!code) {
            return res.status(400).json({ success: false, message: "Coupon code is required" });
        }

        const result = await db.query(`
            SELECT * FROM coupons 
            WHERE code = $1 AND is_active = TRUE
        `, [code.toUpperCase()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Invalid or inactive coupon code" });
        }

        const coupon = result.rows[0];
        const now = new Date();

        // 1. Check expiry
        if (coupon.expiry_date && new Date(coupon.expiry_date) < now) {
            return res.status(400).json({ success: false, message: "Coupon has expired" });
        }

        // 2. Check usage limit
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        // 3. Check minimum amount
        const bookingAmount = parseFloat(amount || 0);
        if (coupon.min_amount && bookingAmount < parseFloat(coupon.min_amount)) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum booking amount of $${coupon.min_amount} required for this coupon` 
            });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discount_type === 'percentage') {
            discount = (bookingAmount * parseFloat(coupon.discount_value)) / 100;
            if (coupon.max_discount && discount > parseFloat(coupon.max_discount)) {
                discount = parseFloat(coupon.max_discount);
            }
        } else {
            discount = parseFloat(coupon.discount_value);
        }

        // Ensure discount doesn't exceed total amount
        if (discount > bookingAmount) discount = bookingAmount;

        res.status(200).json({
            success: true,
            message: "Coupon validated successfully",
            coupon: {
                coupon_id: coupon.coupon_id,
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value,
                applied_discount: parseFloat(discount.toFixed(2))
            }
        });

    } catch (error) {
        console.error("Error validating coupon:", error);
        res.status(500).json({ success: false, message: "Failed to validate coupon" });
    }
};
