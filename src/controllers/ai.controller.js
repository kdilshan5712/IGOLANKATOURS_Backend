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
    console.log("📥 [AI] Custom tour request received:", JSON.stringify(req.body, null, 2));
    const { 
      tourist_id, title, duration_days, travel_month, 
      traveler_count, hotel_preference, 
      estimated_price_min, estimated_price_max,
      recommendations,
      // Guest info
      tourist_name, tourist_email, tourist_phone
    } = req.body;
    const authenticatedUserId = req.user?.user_id;

    if (!authenticatedUserId) {
        return res.status(401).json({ success: false, message: "Authentication required to submit custom tour" });
    }

    let finalTouristId = null;
    console.log("🔍 [AI] Processing submission for user_id:", authenticatedUserId);

    if (authenticatedUserId) {
      const touristLookup = await db.query(
        "SELECT tourist_id FROM tourist WHERE user_id = $1",
        [authenticatedUserId]
      );
      
      console.log("📊 [AI] Tourist lookup rows:", touristLookup.rows.length);
      
      if (touristLookup.rows.length > 0) {
        finalTouristId = touristLookup.rows[0].tourist_id;
        console.log("✅ [AI] Resolved finalTouristId:", finalTouristId);
      } else {
        console.warn(`⚠️ [AI] No tourist profile found for user_id ${authenticatedUserId}. Attempting auto-creation.`);
        try {
          // Auto-recovery: Create a tourist profile if the user exists but the profile is missing
          const recovery = await db.query(
            "INSERT INTO tourist (user_id, full_name, email) VALUES ($1, $2, $3) RETURNING tourist_id",
            [authenticatedUserId, tourist_name || 'Valued Guest', tourist_email]
          );
          finalTouristId = recovery.rows[0].tourist_id;
          console.log("♻️ [AI] Auto-created tourist_id:", finalTouristId);
        } catch (recoveryErr) {
          console.error("❌ [AI] Recovery failed:", recoveryErr.message);
        }
      }
    }

    // Ensure numeric values are numbers
    const duration = parseInt(duration_days) || 1;
    const travelers = parseInt(traveler_count) || 1;
    const priceMin = parseFloat(estimated_price_min) || 0;
    const priceMax = parseFloat(estimated_price_max) || 0;

    console.log(`📝 [AI] Inserting into chatbot_session with tourist_id: ${finalTouristId}`);

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
      finalTouristId || null, 
      title || "Custom Tour Request", 
      duration, 
      travel_month || "Flexible", 
      travelers, 
      hotel_preference || null, 
      priceMin, 
      priceMax,
      recommendations ? (typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations)) : '{}',
      tourist_name || null, 
      tourist_email || null, 
      tourist_phone || null
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
      return res.status(400).json({ success: false, message: "Invalid sessionId or messages" });
    }

    const authenticatedUserId = req.user?.user_id;

    for (const msg of messages) {
      const isUser = msg.sender === "user";
      const isSystem = msg.sender === "system";
      const messageText = msg.text;

      // Map roles to sender/receiver logic
      await db.query(`
        INSERT INTO tour_messages (session_id, message, sender_id, receiver_id, sender_role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        sessionId,
        messageText,
        isUser ? authenticatedUserId : null,
        isUser ? null : (authenticatedUserId || null),
        msg.sender, // Store actual sender role (user/assistant/system)
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
