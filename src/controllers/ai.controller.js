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

export const submitCustomTourRequest = async (req, res) => {
  try {
    const { 
      tourist_id, title, duration_days, travel_month, 
      traveler_count, hotel_preference, 
      estimated_price_min, estimated_price_max,
      recommendations,
      // Guest info
      tourist_name, tourist_email, tourist_phone
    } = req.body;

    const result = await db.query(`
      INSERT INTO chatbot_session (
        tourist_id, title, duration_days, travel_month, 
        traveler_count, hotel_preference, 
        estimated_price_min, estimated_price_max,
        recommendations, status, 
        tourist_name, user_email, tourist_phone,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_approval', $10, $11, $12, NOW())
      RETURNING session_id, created_at
    `, [
      tourist_id || null, title, duration_days, travel_month, 
      traveler_count, hotel_preference, 
      estimated_price_min, estimated_price_max,
      recommendations ? (typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations)) : '{}',
      tourist_name || null, tourist_email || null, tourist_phone || null
    ]);

    res.status(201).json({
      success: true,
      message: "Custom tour submitted for approval",
      session: result.rows[0]
    });

  } catch (err) {
    console.error("submitCustomTourRequest error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit custom tour request",
      error: err.message
    });
  }
};

/**
 * 3️⃣ PUBLIC: SYNC AI CHAT HISTORY
 * POST /api/ai/sync-history
 */
export const syncChatHistory = async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: "Invalid session or messages" });
    }

    // Insert only the latest messages that aren't already system/errors
    // We'll iterate and insert to maintain order, or use a multi-row insert
    for (const msg of messages) {
      // Map roles to sender/receiver logic
      // User: sender_id = UID if exists, receiver = null
      // Assistant: sender = null, receiver = UID if exists
      // If anonymous, we'll use null for UID
      
      const isUser = msg.sender === "user";
      const messageText = msg.text;

      await db.query(`
        INSERT INTO tour_messages (session_id, message, sender_id, receiver_id, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        sessionId,
        messageText,
        isUser ? (req.user?.user_id || null) : null,
        isUser ? null : (req.user?.user_id || null),
        msg.timestamp || new Date()
      ]);
    }

    res.json({ success: true, message: "History synced successfully" });

  } catch (err) {
    console.error("syncChatHistory error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to sync history",
      error: err.message
    });
  }
};
