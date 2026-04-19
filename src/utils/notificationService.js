import db from '../config/db.js';
import { sendEmail } from './emailService.js';
import { emailTemplates } from './emailTemplates.js';
import { sendSMS, getShortMessage } from './smsService.js';

/**
 * Notification Service
 * Handles all notification-related operations
 * Now includes email notifications
 */
export const NotificationService = {
    /**
     * Create a new notification (in-app + email)
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
     * Send email notification based on type
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
     * Send SMS notification based on type
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
     * Map notification types to email templates
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
     * Get user notifications with optional filtering
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
     * Get count of unread notifications
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
     * Mark a notification as read
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
     * Mark all notifications as read for a user
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
     * Delete a notification
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
     * Helper: Notify on booking creation
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
     * Helper: Notify on guide assignment
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
     * Helper: Notify on status change
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
     * Helper: Notify guide approval
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
     * Helper: Notify guide rejection
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
