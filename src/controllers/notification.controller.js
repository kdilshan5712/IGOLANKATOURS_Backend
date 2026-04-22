import { NotificationService } from '../utils/notificationService.js';

/**
 * Retrieves all notifications for the authenticated user with optional filtering.
 * 
 * @async
 * @function getUserNotifications
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {number} [req.query.limit=20] - Max number of notifications to return.
 * @param {string} [req.query.unreadOnly='false'] - Whether to filter for only unread notifications.
 * @param {Object} req.user - Authenticated user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of notifications.
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
 * Retrieves the count of unread notifications for the authenticated user.
 * 
 * @async
 * @function getUnreadCount
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the unread notification count.
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
 * Marks a specific notification as 'read'.
 * 
 * @async
 * @function markNotificationAsRead
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the notification to mark.
 * @param {Object} req.user - Authenticated user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming status update.
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
 * Marks all notifications for the authenticated user as 'read'.
 * 
 * @async
 * @function markAllAsRead
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming all marked.
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
 * Deletes a specific notification record.
 * 
 * @async
 * @function deleteNotification
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the notification to delete.
 * @param {Object} req.user - Authenticated user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion.
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
 * Helper function to create a new notification as a side effect within other operations.
 * 
 * @async
 * @function createNotification
 * @param {string} userId - ID of the user to receive the notification.
 * @param {string} type - Type category of notification.
 * @param {string} message - Content of the notification.
 * @param {string} [link=null] - Optional URL for the user to visit.
 * @returns {Promise<void>}
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
