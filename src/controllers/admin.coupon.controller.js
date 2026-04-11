import db from "../config/db.js";

// List all coupons
export const getAllCoupons = async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM coupons ORDER BY created_at DESC");
        res.status(200).json({ success: true, coupons: result.rows });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        res.status(500).json({ success: false, message: "Failed to fetch coupons" });
    }
};

// Create a new coupon
export const createCoupon = async (req, res) => {
    try {
        const {
            code,
            discount_type,
            discount_value,
            min_amount,
            max_discount,
            start_date,
            expiry_date,
            usage_limit
        } = req.body;

        if (!code || !discount_type || !discount_value) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const result = await db.query(`
            INSERT INTO coupons 
            (code, discount_type, discount_value, min_amount, max_discount, start_date, expiry_date, usage_limit)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            code.toUpperCase(),
            discount_type,
            discount_value,
            min_amount || 0,
            max_discount || null,
            start_date || new Date(),
            expiry_date || null,
            usage_limit || null
        ]);

        res.status(201).json({ success: true, coupon: result.rows[0] });
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).json({ success: false, message: error.code === '23505' ? "Coupon code already exists" : "Failed to create coupon" });
    }
};

// Update a coupon
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active, expiry_date, usage_limit } = req.body;

        const result = await db.query(`
            UPDATE coupons
            SET is_active = COALESCE($1, is_active),
                expiry_date = COALESCE($2, expiry_date),
                usage_limit = COALESCE($3, usage_limit),
                updated_at = NOW()
            WHERE coupon_id = $4
            RETURNING *
        `, [is_active, expiry_date, usage_limit, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({ success: true, coupon: result.rows[0] });
    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({ success: false, message: "Failed to update coupon" });
    }
};

// Delete a coupon
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query("DELETE FROM coupons WHERE coupon_id = $1 RETURNING *", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({ success: true, message: "Coupon deleted successfully" });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({ success: false, message: "Failed to delete coupon" });
    }
};
