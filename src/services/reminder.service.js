import db from '../config/db.js';
import emailService from '../utils/emailService.js';

/**
 * Reminder Service
 * Handles automated payment reminders for bookings with partial payments
 */

export const sendBalanceReminders = async () => {
    console.log("🔔 [ReminderService] Starting automated balance reminders check...");
    
    try {
        // Find bookings that:
        // 1. Have payment_status = 'partial' or (deposit_amount > 0 AND payment_status = 'pending' and status = 'confirmed')
        // 2. Travel date is 30 or 14 days from today
        // 3. Haven't been reminded in the last 24 hours (paranoia check)
        
        const query = `
            SELECT 
                b.booking_id,
                b.total_price,
                b.deposit_amount,
                b.balance_amount,
                b.travel_date,
                u.email as user_email,
                t.full_name as user_name,
                tp.name as package_name
            FROM bookings b
            JOIN users u ON b.user_id = u.user_id
            JOIN tourist t ON u.user_id = t.user_id
            JOIN tour_packages tp ON b.package_id = tp.package_id
            WHERE 
                b.status = 'confirmed' 
                AND b.balance_amount > 0
                AND (
                    (b.payment_status = 'partial') OR 
                    (b.payment_status = 'pending' AND b.deposit_amount > 0)
                )
                AND (
                    DATE(b.travel_date) = CURRENT_DATE + INTERVAL '30 days'
                    OR DATE(b.travel_date) = CURRENT_DATE + INTERVAL '14 days'
                )
                AND (
                    b.last_reminder_sent_at IS NULL 
                    OR b.last_reminder_sent_at < CURRENT_DATE
                )
        `;

        const result = await db.query(query);
        const bookingsToRemind = result.rows;

        console.log(`🔔 [ReminderService] Found ${bookingsToRemind.length} bookings requiring reminders.`);

        for (const booking of bookingsToRemind) {
            try {
                console.log(`📧 [ReminderService] Sending reminder to ${booking.user_email} for booking ${booking.booking_id}`);
                
                await emailService.sendPaymentReminder({
                    userEmail: booking.user_email,
                    userName: booking.user_name,
                    bookingReference: booking.booking_id.substring(0, 8).toUpperCase(),
                    packageName: booking.package_name,
                    travelDate: booking.travel_date,
                    totalPrice: booking.total_price,
                    amountPaid: booking.deposit_amount,
                    balanceAmount: booking.balance_amount
                });

                // Update last_reminder_sent_at
                await db.query(
                    "UPDATE bookings SET last_reminder_sent_at = NOW() WHERE booking_id = $1",
                    [booking.booking_id]
                );

            } catch (err) {
                console.error(`❌ [ReminderService] Failed to send reminder for booking ${booking.booking_id}:`, err);
            }
        }

        console.log("✅ [ReminderService] Finished reminder check.");
        return { success: true, count: bookingsToRemind.length };

    } catch (error) {
        console.error("❌ [ReminderService] Error in balance reminders:", error);
        return { success: false, error: error.message };
    }
};

const reminderService = {
    sendBalanceReminders
};

export default reminderService;
