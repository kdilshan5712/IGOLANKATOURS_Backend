import db from '../config/db.js';
import { sendEmail } from './emailService.js';
import { emailTemplates } from './emailTemplates.js';
import { sendSMS, getShortMessage } from './smsService.js';

/**
 * Notification Service
 * Orchestrates multi-channel notifications including in-app alerts, emails, and SMS.
 * 
 * @namespace NotificationService
 */
export const NotificationService = {
    /**
     * Creates a new notification record in the database and optionally triggers 
     * secondary notifications via email and SMS based on the notification type.
     * 
     * @async
     * @function create
     * @memberof NotificationService
     * @param {Object} params - Notification parameters.
     * @param {string} params.userId - Recipient user ID.
     * @param {string} params.type - The category of notification.
     * @param {string} params.title - Short descriptive title.
     * @param {string} params.message - Detailed notification text.
     * @param {string} [params.link=null] - Optional URL for the user to visit.
     * @param {boolean} [params.sendEmailNotif=true] - Whether to also send an email.
     * @param {Object} [params.emailData={}] - Additional data for the email template.
     * @returns {Promise<Object>} The created notification database record.
     */
    async create({ userId, type, title, message, link = null, sendEmailNotif = true, emailData = {} }) {
        try {
            // Create in-app notification
            const result = await db.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
                [userId, type, title, message, link]
            );

            console.log(`[NOTIFICATION] Created: ${type} for user ${userId}`);

            // Send email if enabled
            if (sendEmailNotif) {
                try {
                    await this.sendEmailNotification(userId, type, { title, message, link, ...emailData });
                } catch (emailError) {
                    console.error('[NOTIFICATION] Email send failed (non-critical):', emailError.message);
                }
            }

            // Send SMS if enabled and it's a "special" event
            const specialTypes = ['booking', 'guide_assignment', 'payment_reminder', 'admin_action'];
            if (specialTypes.includes(type)) {
                try {
                    await this.sendSMSNotification(userId, type, { title, message, ...emailData });
                } catch (smsError) {
                    console.error('[NOTIFICATION] SMS send failed (non-critical):', smsError.message);
                }
            }

            return result.rows[0];
        } catch (error) {
            console.error('[NOTIFICATION] Create error:', error);
            throw error;
        }
    },

    /**
     * Dispatches an email notification to the specified user.
     * Automatically fetches user contact details and selects the appropriate template.
     * 
     * @async
     * @function sendEmailNotification
     * @memberof NotificationService
     * @param {string} userId - Recipient user ID.
     * @param {string} type - Notification type for template selection.
     * @param {Object} data - Dynamic data for the email template.
     * @returns {Promise<boolean>} True if the email was successfully dispatched.
     */
    async sendEmailNotification(userId, type, data) {
        try {
            // Get user email and name
            const userResult = await db.query(
                `SELECT u.email, 
                        COALESCE(t.full_name, tg.full_name, u.email) as full_name
                 FROM users u
                 LEFT JOIN tourist t ON u.user_id = t.user_id
                 LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
                 WHERE u.user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].email) {
                console.warn(`[NOTIFICATION] No email found for user ${userId}`);
                return false;
            }

            const { email, full_name } = userResult.rows[0];
            const template = this.getEmailTemplate(type, full_name, data);

            if (template) {
                await sendEmail(email, template.subject, template.html);
                console.log(`[NOTIFICATION] Email sent to ${email}: ${template.subject}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[NOTIFICATION] Email notification error:', error);
            return false;
        }
    },

    /**
     * Dispatches an SMS notification to the specified user.
     * 
     * @async
     * @function sendSMSNotification
     * @memberof NotificationService
     * @param {string} userId - Recipient user ID.
     * @param {string} type - Notification type for message generation.
     * @param {Object} data - Dynamic data for the SMS message.
     * @returns {Promise<boolean>} True if the SMS was successfully dispatched.
     */
    async sendSMSNotification(userId, type, data) {
        try {
            // Get user phone and name
            const userResult = await db.query(
                `SELECT COALESCE(t.phone, tg.contact_number) as phone,
                        COALESCE(t.full_name, tg.full_name) as full_name
                 FROM users u
                 LEFT JOIN tourist t ON u.user_id = t.user_id
                 LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
                 WHERE u.user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].phone) {
                console.warn(`[NOTIFICATION] No phone number found for user ${userId}`);
                return false;
            }

            const { phone, full_name } = userResult.rows[0];
            const smsMessage = getShortMessage(type, { ...data, full_name });

            if (smsMessage) {
                await sendSMS(phone, smsMessage, type);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[NOTIFICATION] SMS notification error:', error);
            return false;
        }
    },

    /**
     * Maps internal notification types to branded email templates.
     * 
     * @function getEmailTemplate
     * @memberof NotificationService
     * @param {string} type - The notification type.
     * @param {string} userName - Name of the user for personalization.
     * @param {Object} data - Metadata for the template.
     * @returns {Object|null} An object containing subject and html, or null.
     */
    getEmailTemplate(type, userName, data) {
        switch (type) {
            case 'booking':
                if (data.message?.includes('Confirmed')) {
                    return emailTemplates.bookingConfirmed(
                        userName, 
                        data.packageName || 'Your Tour', 
                        {
                            booking_id: data.bookingId,
                            travel_date: data.travelDate || new Date(),
                            travelers: data.travelers || 1
                        }
                    );
                }
                if (data.message?.includes('Cancelled')) {
                    return emailTemplates.bookingCancelled(
                        userName, 
                        data.packageName || 'Your Tour', 
                        {
                            amount: data.refundAmount || 0,
                            percentage: data.refundPercentage || 0,
                            status: 'Completed'
                        }
                    );
                }
                break;

            case 'review':
                if (data.message?.includes('submitted')) {
                    return emailTemplates.reviewSubmitted(userName);
                }
                if (data.message?.includes('approved')) {
                    return emailTemplates.reviewApproved(userName);
                }
                if (data.message?.includes('rejected') || data.message?.includes('revision')) {
                    return emailTemplates.reviewRejected(userName, data.reason);
                }
                break;

            case 'admin_action':
            case 'guide_approval':
                if (data.message?.includes('approved') || data.title?.includes('Approved')) {
                    return emailTemplates.guideApproved(userName);
                }
                if (data.message?.includes('rejected') || data.message?.includes('revision')) {
                    return emailTemplates.guideRejected(userName, data.reason);
                }
                break;

            case 'guide_assignment':
                return emailTemplates.guideAssigned(
                    userName, 
                    data.guideName || 'A Professional Guide', 
                    data.packageName || 'Your Tour', 
                    data.tourDate || new Date()
                );

            default:
                // Fallback for other notification types
                return {
                    subject: data.title || 'Notification from I GO LANKA TOURS',
                    html: emailTemplates.emailWrapper(`
                        <h2 style="color: #0f172a; margin: 0 0 20px 0; font-size: 24px;">${data.title || 'New Notification'}</h2>
                        <p style="font-size: 17px; line-height: 1.8;">Hi ${userName},</p>
                        <p style="font-size: 17px; line-height: 1.8;">${data.message}</p>
                        ${data.link ? `<div style="text-align: center; margin-top: 30px;"><a href="${process.env.FRONTEND_URL}${data.link}" style="display: inline-block; background: #1e3a8a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Details</a></div>` : ''}
                    `)
                };
        }

        return null;
    },

    /**
     * Retrieves in-app notifications for a specific user with optional filtering.
     * 
     * @async
     * @function getUserNotifications
     * @memberof NotificationService
     * @param {string} userId - Target user ID.
     * @param {number} [limit=20] - Max number of notifications to return.
     * @param {boolean} [unreadOnly=false] - Whether to only fetch unread notifications.
     * @returns {Promise<Array<Object>>} A list of notification records.
     */
    async getUserNotifications(userId, limit = 20, unreadOnly = false) {
        try {
            let query = `
        SELECT * FROM notifications
        WHERE user_id = $1
      `;

            if (unreadOnly) {
                query += ` AND read = FALSE`;
            }

            query += ` ORDER BY created_at DESC LIMIT $2`;

            const result = await db.query(query, [userId, limit]);
            return result.rows;
        } catch (error) {
            console.error('[NOTIFICATION] Get notifications error:', error);
            throw error;
        }
    },

    /**
     * Calculates the total number of unread notifications for a user.
     * 
     * @async
     * @function getUnreadCount
     * @memberof NotificationService
     * @param {string} userId - Target user ID.
     * @returns {Promise<number>} The count of unread notifications.
     */
    async getUnreadCount(userId) {
        try {
            const result = await db.query(
                `SELECT COUNT(*) as count FROM notifications
         WHERE user_id = $1 AND read = FALSE`,
                [userId]
            );
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('[NOTIFICATION] Get unread count error:', error);
            throw error;
        }
    },

    /**
     * Updates the status of a specific notification to 'read'.
     * 
     * @async
     * @function markAsRead
     * @memberof NotificationService
     * @param {string} notificationId - ID of the notification.
     * @param {string} userId - User ID (for ownership verification).
     * @returns {Promise<Object>} The updated notification record.
     */
    async markAsRead(notificationId, userId) {
        try {
            const result = await db.query(
                `UPDATE notifications
         SET read = TRUE, read_at = CURRENT_TIMESTAMP
         WHERE notification_id = $1 AND user_id = $2
         RETURNING *`,
                [notificationId, userId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('[NOTIFICATION] Mark as read error:', error);
            throw error;
        }
    },

    /**
     * Marks all unread notifications for a user as 'read'.
     * 
     * @async
     * @function markAllAsRead
     * @memberof NotificationService
     * @param {string} userId - Target user ID.
     * @returns {Promise<boolean>} True if the bulk update was successful.
     */
    async markAllAsRead(userId) {
        try {
            await db.query(
                `UPDATE notifications
         SET read = TRUE, read_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND read = FALSE`,
                [userId]
            );
            return true;
        } catch (error) {
            console.error('[NOTIFICATION] Mark all as read error:', error);
            throw error;
        }
    },

    /**
     * Permanently removes a notification from the database.
     * 
     * @async
     * @function delete
     * @memberof NotificationService
     * @param {string} notificationId - ID of the notification to remove.
     * @param {string} userId - User ID (for ownership verification).
     * @returns {Promise<boolean>} True if deletion was successful.
     */
    async delete(notificationId, userId) {
        try {
            await db.query(
                `DELETE FROM notifications
         WHERE notification_id = $1 AND user_id = $2`,
                [notificationId, userId]
            );
            return true;
        } catch (error) {
            console.error('[NOTIFICATION] Delete error:', error);
            throw error;
        }
    },

    /**
     * High-level helper to notify a tourist of a new booking confirmation.
     * 
     * @async
     * @function notifyBookingCreated
     * @memberof NotificationService
     * @param {string} touristId - ID of the tourist.
     * @param {string} packageName - Name of the package.
     * @param {string} bookingId - Reference ID for the booking.
     * @returns {Promise<void>}
     */
    async notifyBookingCreated(touristId, packageName, bookingId) {
        await this.create({
            userId: touristId,
            type: 'booking',
            title: 'Booking Confirmed',
            message: `Your booking for ${packageName} has been confirmed!`,
            link: `/dashboard/bookings/${bookingId}`,
            emailData: { packageName, bookingId }
        });
    },

    /**
     * High-level helper to notify a guide of a new tour assignment.
     * 
     * @async
     * @function notifyGuideAssignment
     * @memberof NotificationService
     * @param {string} guideId - ID of the guide user.
     * @param {string} packageName - Name of the tour package.
     * @param {string|Date} tourDate - The date of the tour.
     * @returns {Promise<void>}
     */
    async notifyGuideAssignment(guideId, packageName, tourDate) {
        await this.create({
            userId: guideId,
            type: 'guide_assignment',
            title: 'New Tour Assignment',
            message: `You have been assigned to ${packageName} on ${new Date(tourDate).toLocaleDateString()}`,
            link: `/guide/bookings`,
            emailData: { packageName, tourDate }
        });
    },

    /**
     * High-level helper to notify a user of a status change in their booking.
     * 
     * @async
     * @function notifyStatusChange
     * @memberof NotificationService
     * @param {string} userId - Target user ID.
     * @param {string} status - The new status label.
     * @param {string} bookingId - ID of the associated booking.
     * @returns {Promise<void>}
     */
    async notifyStatusChange(userId, status, bookingId) {
        await this.create({
            userId: userId,
            type: 'status_change',
            title: 'Booking Status Updated',
            message: `Your booking status has been updated to ${status}`,
            link: `/dashboard/bookings/${bookingId}`
        });
    },

    /**
     * High-level helper to notify a guide applicant of their successful approval.
     * 
     * @async
     * @function notifyGuideApproved
     * @memberof NotificationService
     * @param {string} guideId - ID of the approved guide.
     * @returns {Promise<void>}
     */
    async notifyGuideApproved(guideId) {
        await this.create({
            userId: guideId,
            type: 'admin_action',
            title: 'Application Approved! 🎉',
            message: 'Congratulations! Your guide application has been approved. You can now start accepting tour assignments.',
            link: '/guide/dashboard'
        });
    },

    /**
     * High-level helper to notify a guide applicant that their application was rejected or needs revision.
     * 
     * @async
     * @function notifyGuideRejected
     * @memberof NotificationService
     * @param {string} guideId - ID of the guide user.
     * @param {string} reason - The specific reason for rejection or revision request.
     * @returns {Promise<void>}
     */
    async notifyGuideRejected(guideId, reason) {
        await this.create({
            userId: guideId,
            type: 'admin_action',
            title: 'Application Requires Revision',
            message: `Your guide application needs revision. Reason: ${reason}`,
            link: '/guide/rejected',
            emailData: { reason }
        });
    }
};
