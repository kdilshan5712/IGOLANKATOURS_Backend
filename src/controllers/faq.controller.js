import db from '../config/db.js';

/**
 * Retrieves all active FAQs and groups them by category for the public FAQ page.
 * 
 * @async
 * @function getAllFaqs
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with grouped FAQ data.
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
 * Retrieves a flat list of all FAQs for administrative management.
 * 
 * @async
 * @function getAdminFaqs
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of all FAQs.
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
 * Creates a new FAQ entry with a specified category, question, and answer.
 * 
 * @async
 * @function createFaq
 * @param {Object} req - Express request object.
 * @param {Object} req.body - FAQ details.
 * @param {string} req.body.category - Category the FAQ belongs to.
 * @param {string} req.body.question - The question text.
 * @param {string} req.body.answer - The answer text.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created FAQ.
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
 * Updates an existing FAQ's details or activation status.
 * 
 * @async
 * @function updateFaq
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the FAQ to update.
 * @param {Object} req.body - Updated FAQ data.
 * @param {string} [req.body.category] - Updated category.
 * @param {string} [req.body.question] - Updated question.
 * @param {string} [req.body.answer] - Updated answer.
 * @param {boolean} [req.body.is_active] - Updated activation status.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated FAQ.
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
 * Deletes an FAQ entry permanently from the database.
 * 
 * @async
 * @function deleteFaq
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the FAQ to delete.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion.
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
