import db from "../config/db.js";

// Get all pricing rules
export const getAllRules = async (req, res) => {
    try {
        const result = await db.query(`
      SELECT * FROM seasonal_pricing_rules 
      ORDER BY start_month, start_day ASC
    `);

        res.status(200).json({
            success: true,
            rules: result.rows
        });
    } catch (error) {
        console.error("Error fetching pricing rules:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch pricing rules"
        });
    }
};

// Create new pricing rule
export const createRule = async (req, res) => {
    try {
        const {
            name,
            start_month,
            start_day,
            end_month,
            end_day,
            percentage,
            coast_type // 'south', 'east', 'all'
        } = req.body;

        // Basic validation
        if (!name || !start_month || !start_day || !end_month || !end_day || percentage === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const result = await db.query(`
      INSERT INTO seasonal_pricing_rules 
      (name, start_month, start_day, end_month, end_day, percentage, coast_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, start_month, start_day, end_month, end_day, percentage, coast_type || 'all']);

        res.status(201).json({
            success: true,
            message: "Pricing rule created successfully",
            rule: result.rows[0]
        });
    } catch (error) {
        console.error("Error creating pricing rule:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to create pricing rule",
            details: error.message
        });
    }
};

// Update pricing rule
export const updateRule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            start_month,
            start_day,
            end_month,
            end_day,
            percentage,
            coast_type,
            is_active
        } = req.body;

        const result = await db.query(`
      UPDATE seasonal_pricing_rules
      SET 
        name = COALESCE($1, name),
        start_month = COALESCE($2, start_month),
        start_day = COALESCE($3, start_day),
        end_month = COALESCE($4, end_month),
        end_day = COALESCE($5, end_day),
        percentage = COALESCE($6, percentage),
        coast_type = COALESCE($7, coast_type),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE rule_id = $9
      RETURNING *
    `, [name, start_month, start_day, end_month, end_day, percentage, coast_type, is_active, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Pricing rule not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Pricing rule updated successfully",
            rule: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating pricing rule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update pricing rule"
        });
    }
};

// Delete pricing rule
export const deleteRule = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
      DELETE FROM seasonal_pricing_rules
      WHERE rule_id = $1
      RETURNING *
    `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Pricing rule not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Pricing rule deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting pricing rule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete pricing rule"
        });
    }
};
