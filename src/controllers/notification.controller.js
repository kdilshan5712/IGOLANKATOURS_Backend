import { NotificationService } from '../utils/notificationService.js';

/**
 * GET /api/notifications
 * Get all notifications for logged-in user
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { limit = 20, unreadOnly = 'false' } = req.query;

    const notifications = await NotificationService.getUserNotifications(
      userId,
      parseInt(limit),
      unreadOnly === 'true'
    );

    res.json({
      success: true,
      count: notifications.length,
      notifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('[NOTIFICATION] Get notifications error:', error);
    // Return empty notifications instead of error to prevent blocking the UI
    res.json({
      success: true,
      notifications: [],
      unreadCount: 0
    });
  }
};

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const count = await NotificationService.getUnreadCount(userId);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('[NOTIFICATION] Get unread count error:', error);
    res.json({
      success: true,
      count: 0
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

    const notification = await NotificationService.markAsRead(id, userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
};

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('[NOTIFICATION] Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all as read'
    });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;

    await NotificationService.delete(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('[NOTIFICATION] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

/**
 * Helper function to create a notification
 * Can be called from other controllers
 */
export const createNotification = async (userId, type, message, link = null) => {
  try {
    await NotificationService.create({
      userId,
      type,
      title: type.replace('_', ' ').toUpperCase(),
      message,
      link
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};
