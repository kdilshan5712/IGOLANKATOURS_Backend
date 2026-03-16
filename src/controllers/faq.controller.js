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
