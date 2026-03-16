import db from '../config/db.js';

/**
 * AI CONTROLLER
 * Handles AI-specific logic like saving sessions and recommendations
 */

/**
 * 1️⃣ PUBLIC: SAVE CHATBOT SESSION
 * POST /api/ai/session
 * Body: { tourist_id, preferences, recommendations }
 */
export const saveChatbotSession = async (req, res) => {
  try {
    const { tourist_id, preferences, recommendations } = req.body;

    // Validate inputs - basics only as it can be partially filled
    const result = await db.query(`
      INSERT INTO chatbot_session (tourist_id, preferences, recommendations, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING session_id, created_at
    `, [
      tourist_id || null,
      preferences ? JSON.stringify(preferences) : '{}',
      recommendations ? JSON.stringify(recommendations) : '{}'
    ]);

    res.status(201).json({
      success: true,
      message: "Chatbot session saved successfully",
      session: result.rows[0]
    });

  } catch (err) {
    console.error("saveChatbotSession error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save chatbot session",
      error: err.message
    });
  }
};
