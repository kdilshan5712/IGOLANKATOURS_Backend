import twilio from 'twilio';
import pool from '../config/db.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const smsEnabled = process.env.SMS_ENABLED === 'true';

let client;
if (smsEnabled && accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

/**
 * Log SMS sending attempt
 */
const logSms = async (to, message, type, status, errorMessage = null) => {
    try {
        await pool.query(
            `INSERT INTO sms_logs (recipient_phone, message, type, status, error_message)
             VALUES ($1, $2, $3, $4, $5)`,
            [to, message, type, status, errorMessage]
        );
    } catch (error) {
        console.error('Error logging SMS:', error);
    }
};

/**
 * Generic SMS sending function
 */
export const sendSMS = async (to, message, type = 'general') => {
    console.log(`[SMS-DEBUG] sendSMS called to: ${to}, type: ${type}`);
    if (!smsEnabled || !client) {
        console.warn('⚠️ SMS notifications are disabled or missing credentials');
        return { success: false, error: 'SMS disabled' };
    }

    try {
        const result = await client.messages.create({
            body: message,
            from: fromNumber,
            to: to
        });

        console.log(`✅ SMS sent to ${to}: ${result.sid}`);
        await logSms(to, message, type, 'sent');
        
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error(`❌ Error sending SMS to ${to}:`, error.message);
        await logSms(to, message, type, 'failed', error.message);
        
        return { success: false, error: error.message };
    }
};

/**
 * Map notification data to short SMS message
 */
export const getShortMessage = (type, data) => {
    switch (type) {
        case 'booking':
            if (data.message?.toLowerCase().includes('confirmed') || data.title?.toLowerCase().includes('confirmed')) {
                return `Booking Confirmed! Package: ${data.packageName || 'Your Tour'}. ID: ${data.bookingId || 'N/A'}. See you soon! - I Go Lanka`;
            }
            if (data.message?.toLowerCase().includes('cancelled') || data.title?.toLowerCase().includes('cancelled')) {
                return `Booking Cancelled: ${data.packageName || 'Your Tour'}. Refund will be processed. - I Go Lanka`;
            }
            // Fallback for any other booking event
            return `Booking Update: ${data.title || data.message || 'Your booking has been updated'}. - I Go Lanka Tours`;

        case 'guide_assignment':
            return `Tour Assigned! You are assigned to ${data.packageName} on ${new Date(data.tourDate).toLocaleDateString()}. Check dashboard. - I Go Lanka`;

        case 'payment_reminder':
            return `Payment Due: Trip to ${data.packageName}. Balance: $${data.balanceAmount}. Please pay by ${new Date(data.travelDate).toLocaleDateString()}. - I Go Lanka`;

        case 'admin_action':
            if (data.message?.includes('approved')) {
                return `Application Approved! 🎉 Congratulations, you are now an official guide for I Go Lanka Tours.`;
            }
            break;

        default:
            // Fallback: Use the message provided, or the title, or a generic string
            const fallback = data.message || data.title || 'New update from I Go Lanka';
            return fallback.length > 150 ? fallback.substring(0, 147) + '...' : fallback;
    }
    return null;
};

const smsService = {
    sendSMS,
    getShortMessage
};

export default smsService;
