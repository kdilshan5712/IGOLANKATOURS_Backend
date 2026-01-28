import db from "../config/db.js";

/**
 * GET /api/notifications
 * Get all notifications for logged-in user
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      `SELECT 
        notification_id,
        type,
        message,
        is_read,
        created_at
      FROM notification
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      notifications: result.rows,
      unreadCount: result.rows.filter(n => !n.is_read).length
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    // Verify notification belongs to user
    const checkResult = await db.query(
      `SELECT notification_id FROM notification WHERE notification_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    // Mark as read
    await db.query(
      `UPDATE notification SET is_read = true WHERE notification_id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update notification"
    });
  }
};

/**
 * Helper function to create a notification
 * Can be called from other controllers
 */
export const createNotification = async (userId, type, message) => {
  try {
    await db.query(
      `INSERT INTO notification (user_id, type, message, is_read)
       VALUES ($1, $2, $3, false)`,
      [userId, type, message]
    );
  } catch (err) {
    console.error("Error creating notification:", err);
  }
};
