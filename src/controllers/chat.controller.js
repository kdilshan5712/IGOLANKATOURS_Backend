import db from "../config/db.js";

// ======================================================
//    GET TOUR MESSAGES
//    GET /api/chat/:bookingId
//    Auth: Required (Tourist or Assigned Guide)
//    ====================================================== */
export const getTourMessages = async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user.user_id || req.user.id;
    const userRole = req.user.role;

    try {
        // 1. Verify access to this booking
        let bookingQuery = `SELECT * FROM bookings WHERE booking_id = $1`;
        const bookingResult = await db.query(bookingQuery, [bookingId]);

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const booking = bookingResult.rows[0];

        // Check permissions (Admins have full access, skip checks)
        if (userRole !== "admin") {
            if (userRole === "tourist" && booking.user_id !== userId) {
                return res.status(403).json({ success: false, message: "Not authorized to view this chat" });
            }

            if (userRole === "guide") {
                // assigned_guide_id stores tour_guide.guide_id, but JWT has user_id
                // So we need to look up the user_id for the assigned guide
                const guideUserResult = await db.query(
                    `SELECT user_id FROM tour_guide WHERE guide_id = $1`,
                    [booking.assigned_guide_id]
                );
                const assignedGuideUserId = guideUserResult.rows[0]?.user_id;
                if (assignedGuideUserId !== userId) {
                    return res.status(403).json({ success: false, message: "Not authorized to view this chat" });
                }
            }
        }

        // 2. Fetch messages
        const messagesQuery = `
      SELECT 
        m.id, 
        m.booking_id, 
        m.sender_id, 
        m.receiver_id, 
        m.message, 
        m.is_read, 
        m.created_at,
        COALESCE(t.full_name, tg.full_name, 'Admin') as sender_name,
        u.role as sender_role
      FROM tour_messages m
      JOIN users u ON m.sender_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
      WHERE m.booking_id = $1
      ORDER BY m.created_at ASC
    `;

        const messagesResult = await db.query(messagesQuery, [bookingId]);

        // 3. Mark unread messages directed to this user as read
        if (userRole !== "admin") {
            const updateReadQuery = `
              UPDATE tour_messages 
              SET is_read = true 
              WHERE booking_id = $1 AND receiver_id = $2 AND is_read = false
            `;
            await db.query(updateReadQuery, [bookingId, userId]);
        }

        return res.status(200).json({
            success: true,
            is_chat_authorized: booking.is_chat_authorized,
            messages: messagesResult.rows
        });

    } catch (error) {
        console.error("Error in getTourMessages:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// ======================================================
//    SEND TOUR MESSAGE
//    POST /api/chat/:bookingId
//    Auth: Required (Tourist or Assigned Guide)
//    ====================================================== */
export const sendTourMessage = async (req, res) => {
    const { bookingId } = req.params;
    const { message } = req.body;
    const senderId = req.user.user_id || req.user.id;
    const userRole = req.user.role;

    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    try {
        // 1. Verify access and determine receiver
        let bookingQuery = `SELECT * FROM bookings WHERE booking_id = $1`;
        const bookingResult = await db.query(bookingQuery, [bookingId]);

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const booking = bookingResult.rows[0];

        if (!booking.is_chat_authorized && userRole !== 'admin') {
            return res.status(403).json({ success: false, message: "Chat is currently locked by the admin" });
        }

        let receiverId = null;

        if (userRole === "tourist") {
            if (booking.user_id !== senderId) {
                return res.status(403).json({ success: false, message: "Not authorized to send message for this booking" });
            }
            if (!booking.assigned_guide_id) {
                return res.status(400).json({ success: false, message: "No guide assigned to this tour yet" });
            }
            // assigned_guide_id is tour_guide.guide_id — look up their user_id
            const guideUserRes = await db.query(`SELECT user_id FROM tour_guide WHERE guide_id = $1`, [booking.assigned_guide_id]);
            receiverId = guideUserRes.rows[0]?.user_id || null;
            if (!receiverId) {
                return res.status(400).json({ success: false, message: "Assigned guide account not found" });
            }
        } else if (userRole === "guide") {
            // Look up this guide's guide_id from their user_id
            const guideRecordRes = await db.query(`SELECT user_id FROM tour_guide WHERE guide_id = $1`, [booking.assigned_guide_id]);
            const assignedGuideUserId = guideRecordRes.rows[0]?.user_id;
            if (assignedGuideUserId !== senderId) {
                return res.status(403).json({ success: false, message: "Not authorized to send message for this booking" });
            }
            receiverId = booking.user_id;
        } else if (userRole === "admin") {
            // Admin sending a message into the tour chat
            // By default, we link the receiver to the tourist, but the frontend will show it to everyone in the booking room
            receiverId = booking.user_id;
        } else {
            return res.status(403).json({ success: false, message: "Invalid role for tour chat" });
        }

        // 2. Insert message
        const insertQuery = `
      INSERT INTO tour_messages (booking_id, sender_id, receiver_id, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

        const insertResult = await db.query(insertQuery, [bookingId, senderId, receiverId, message]);
        const newMessage = insertResult.rows[0];

        // Fetch sender info to return complete message object
        const senderQuery = `
          SELECT 
            u.role,
            COALESCE(t.full_name, tg.full_name, 'Admin') as full_name
          FROM users u 
          LEFT JOIN tourist t ON u.user_id = t.user_id
          LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
          WHERE u.user_id = $1
        `;
        const senderInfoResult = await db.query(senderQuery, [senderId]);

        if (senderInfoResult.rows.length > 0) {
            newMessage.sender_name = senderInfoResult.rows[0].full_name;
            newMessage.sender_role = senderInfoResult.rows[0].role;
        }

        // Future enhancement: emit socket.io event or send notification email to receiver here if offline

        return res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: newMessage
        });

    } catch (error) {
        console.error("Error in sendTourMessage:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// ======================================================
//    AUTHORIZE/REVOKE TOUR CHAT
//    PATCH /api/chat/:bookingId/authorize
//    Auth: Required (Admin only)
//    ====================================================== */
export const authorizeChat = async (req, res) => {
    const { bookingId } = req.params;
    const { is_authorized } = req.body;
    const userRole = req.user.role;
    const adminId = req.user.user_id || req.user.id;

    if (userRole !== 'admin') {
        return res.status(403).json({ success: false, message: "Only admins can authorize chats" });
    }

    if (typeof is_authorized !== 'boolean') {
        return res.status(400).json({ success: false, message: "is_authorized must be a boolean" });
    }

    try {
        // 1. Verify booking
        const bookingQuery = `SELECT * FROM bookings WHERE booking_id = $1`;
        const bookingResult = await db.query(bookingQuery, [bookingId]);

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // 2. Update authorization status
        const updateQuery = `
            UPDATE bookings 
            SET is_chat_authorized = $1 
            WHERE booking_id = $2 
            RETURNING *
        `;
        const updateResult = await db.query(updateQuery, [is_authorized, bookingId]);

        // 3. Insert System Message
        const actionStr = is_authorized ? "unlocked" : "locked";
        const systemMessage = `🛡️ System: An admin has ${actionStr} this chat room.`;

        const insertMsgQuery = `
            INSERT INTO tour_messages (booking_id, sender_id, receiver_id, message)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        // Admin sends it, to the tourist (as a proxy receiver, though chat shows to everyone)
        await db.query(insertMsgQuery, [bookingId, adminId, bookingResult.rows[0].user_id, systemMessage]);

        return res.status(200).json({
            success: true,
            message: `Chat has been successfully ${actionStr}`,
            is_chat_authorized: updateResult.rows[0].is_chat_authorized
        });

    } catch (error) {
        console.error("Error in authorizeChat:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
