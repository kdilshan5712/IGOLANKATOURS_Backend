import db from '../config/db.js';

/**
 * GET ALL FAQS
 * GET /api/faqs
 * Auth: Public
 */
export const getAllFaqs = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT category, question, answer FROM faqs WHERE is_active = true ORDER BY created_at ASC`
        );

        // Group by category for the frontend
        const groupedFaqs = result.rows.reduce((acc, current) => {
            // Find existing category group
            let group = acc.find(g => g.category === current.category);
            if (!group) {
                group = { category: current.category, items: [] };
                acc.push(group);
            }
            group.items.push({
                question: current.question,
                answer: current.answer
            });
            return acc;
        }, []);

        return res.json({
            success: true,
            faqData: groupedFaqs
        });
    } catch (error) {
        console.error("Error fetching FAQs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch FAQs",
            error: error.message
        });
    }
};
/**
 * GET ALL FAQS (FOR ADMIN - Flat list)
 * GET /api/admin/faqs
 * Auth: Admin
 */
export const getAdminFaqs = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, category, question, answer, is_active FROM faqs ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            faqs: result.rows
        });
    } catch (error) {
        console.error("Error fetching admin FAQs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch FAQs",
            error: error.message
        });
    }
};

/**
 * CREATE NEW FAQ
 * POST /api/admin/faqs
 * Auth: Admin
 */
export const createFaq = async (req, res) => {
    const { category, question, answer } = req.body;

    if (!category || !question || !answer) {
        return res.status(400).json({
            success: false,
            message: "Category, question, and answer are required"
        });
    }

    try {
        const result = await db.query(
            `INSERT INTO faqs (category, question, answer)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [category, question, answer]
        );

        return res.status(201).json({
            success: true,
            message: "FAQ created successfully",
            faq: result.rows[0]
        });
    } catch (error) {
        console.error("Error creating FAQ:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create FAQ",
            error: error.message
        });
    }
};

/**
 * UPDATE FAQ
 * PUT /api/admin/faqs/:id
 * Auth: Admin
 */
export const updateFaq = async (req, res) => {
    const { id } = req.params;
    const { category, question, answer, is_active } = req.body;

    try {
        const result = await db.query(
            `UPDATE faqs 
             SET category = COALESCE($1, category),
                 question = COALESCE($2, question),
                 answer = COALESCE($3, answer),
                 is_active = COALESCE($4, is_active)
             WHERE id = $5
             RETURNING *`,
            [category, question, answer, is_active, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "FAQ not found"
            });
        }

        return res.json({
            success: true,
            message: "FAQ updated successfully",
            faq: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating FAQ:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update FAQ",
            error: error.message
        });
    }
};

/**
 * DELETE FAQ
 * DELETE /api/admin/faqs/:id
 * Auth: Admin
 */
export const deleteFaq = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(
            "DELETE FROM faqs WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "FAQ not found"
            });
        }

        return res.json({
            success: true,
            message: "FAQ deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting FAQ:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete FAQ",
            error: error.message
        });
    }
};
