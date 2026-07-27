import db from "../config/db.js";

// ==========================================
// ADMIN CONTROLLERS (Manage Promotions)
// ==========================================

export const getAllPromotions = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM promotions 
      ORDER BY created_at DESC
    `);
    res.status(200).json({ success: true, promotions: result.rows });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({ success: false, message: "Failed to fetch promotions" });
  }
};

export const createPromotion = async (req, res) => {
  try {
    const { title, description, discount_code, discount_percentage, image_url, display_style, is_active, start_date, end_date } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and description are required" });
    }

    const result = await db.query(`
      INSERT INTO promotions (title, description, discount_code, discount_percentage, image_url, display_style, is_active, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [title, description, discount_code || null, discount_percentage || 0, image_url || null, display_style || 'banner', is_active ?? true, start_date || null, end_date || null]);

    res.status(201).json({ success: true, message: "Promotion created successfully", promotion: result.rows[0] });
  } catch (error) {
    console.error("Error creating promotion:", error);
    res.status(500).json({ success: false, message: "Failed to create promotion" });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, discount_code, discount_percentage, image_url, display_style, is_active, start_date, end_date } = req.body;

    const result = await db.query(`
      UPDATE promotions
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          discount_code = $3,
          discount_percentage = COALESCE($4, discount_percentage),
          image_url = $5,
          display_style = COALESCE($6, display_style),
          is_active = COALESCE($7, is_active),
          start_date = $8,
          end_date = $9,
          updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [title, description, discount_code, discount_percentage, image_url, display_style, is_active, start_date, end_date, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Promotion not found" });
    }

    res.status(200).json({ success: true, message: "Promotion updated successfully", promotion: result.rows[0] });
  } catch (error) {
    console.error("Error updating promotion:", error);
    res.status(500).json({ success: false, message: "Failed to update promotion" });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM promotions WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Promotion not found" });
    }
    
    res.status(200).json({ success: true, message: "Promotion deleted successfully" });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    res.status(500).json({ success: false, message: "Failed to delete promotion" });
  }
};

// ==========================================
// PUBLIC CONTROLLER (Homepage view)
// ==========================================

export const getActivePromotions = async (req, res) => {
  try {
    // Fetch promotions that are active, and where the current date is between start_date and end_date (if provided)
    const result = await db.query(`
      SELECT * FROM promotions 
      WHERE is_active = true 
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY created_at DESC
    `);
    res.status(200).json({ success: true, promotions: result.rows });
  } catch (error) {
    console.error("Error fetching active promotions:", error);
    res.status(500).json({ success: false, message: "Failed to fetch promotions" });
  }
};
