import db from '../src/config/db.js';

async function performTest() {
  try {
    console.log("Starting Verification...");
    
    // 1. Find a candidate booking with an assigned guide
    const bResult = await db.query(
      "SELECT b.booking_id, b.assigned_guide_id, b.total_price, tg.commission_rate " +
      "FROM bookings b " +
      "JOIN tour_guide tg ON b.assigned_guide_id = tg.guide_id " +
      "WHERE b.status IN ('confirmed', 'pending') " +
      "LIMIT 1"
    );

    if (bResult.rows.length === 0) {
      console.log("No candidate bookings found with assigned guides.");
      process.exit(0);
    }

    const booking = bResult.rows[0];
    console.log(`Testing with Booking ID: ${booking.booking_id} (Type: ${typeof booking.booking_id})`);
    console.log(`Guide ID: ${booking.assigned_guide_id}, Rate: ${booking.commission_rate}, Total: ${booking.total_price}`);

    // 2. Mock calculation
    const price = parseFloat(booking.total_price);
    const rate = parseFloat(booking.commission_rate || 0.10);
    const commissionAmount = price * rate;
    console.log(`Calculated Commission: ${commissionAmount}`);

    // 3. Update status to 'completed' and set commission
    // Note: booking_id is integer
    const updateRes = await db.query(
      "UPDATE bookings SET status = 'completed', commission_amount = $1 WHERE booking_id = $2 RETURNING booking_id, status, commission_amount",
      [commissionAmount, parseInt(booking.booking_id)]
    );

    console.log("Update Success:", updateRes.rows[0]);

    // 4. Test Guide Dashboard Stats logic (simulated)
    const statsRes = await db.query(
      "SELECT COALESCE(SUM(commission_amount), 0) as total_earnings FROM bookings WHERE assigned_guide_id = $1 AND status = 'completed'",
      [booking.assigned_guide_id]
    );
    console.log("Guide Earnings for this guide:", statsRes.rows[0].total_earnings);

    // 5. Cleanup (optional, but good for testability)
    console.log("Verification finished successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Verification Failed:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    process.exit(1);
  }
}

performTest();
