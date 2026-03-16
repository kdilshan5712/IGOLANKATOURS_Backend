import db from './src/config/db.js';
import reminderService from './src/services/reminder.service.js';

async function verify() {
  try {
    console.log("🧪 Starting Verification Test...");

    // 1. Create a mock booking that should be reminded
    const travelDate30 = new Date();
    travelDate30.setDate(travelDate30.getDate() + 30);
    const dateStr30 = travelDate30.toISOString().split('T')[0];

    console.log(`📅 Mocking a booking for travel date: ${dateStr30} (30 days away)`);

    // We need a valid user and package ID. Let's find some.
    const userRes = await db.query("SELECT user_id FROM users LIMIT 1");
    const packageRes = await db.query("SELECT package_id FROM tour_packages LIMIT 1");

    if (userRes.rows.length === 0 || packageRes.rows.length === 0) {
      console.log("⚠️ No users or packages found in DB. Skipping automated DB insertion test.");
    } else {
      const user_id = userRes.rows[0].user_id;
      const package_id = packageRes.rows[0].package_id;

      const bookingInsert = await db.query(
        `INSERT INTO bookings 
         (user_id, package_id, travel_date, travelers, total_price, deposit_amount, balance_amount, status, payment_status, created_at)
         VALUES ($1, $2, $3, 1, 1000, 300, 700, 'confirmed', 'partial', NOW())
         RETURNING booking_id`,
        [user_id, package_id, dateStr30]
      );
      
      const mockBookingId = bookingInsert.rows[0].booking_id;
      console.log(`✅ Created mock booking: ${mockBookingId}`);

      // 2. Run reminder service
      console.log("🔔 Running reminder service...");
      const reminderResult = await reminderService.sendBalanceReminders();
      console.log("📊 Reminder Result:", reminderResult);

      // Clean up mock booking
      await db.query("DELETE FROM bookings WHERE booking_id = $1", [mockBookingId]);
      console.log("🗑️ Cleaned up mock booking.");
    }

    console.log("✅ Verification complete.");

  } catch (err) {
    console.error("❌ Verification failed:", err);
  } finally {
    process.exit(0);
  }
}

verify();
