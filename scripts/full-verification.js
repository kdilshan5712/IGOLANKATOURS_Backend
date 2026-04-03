import db from '../src/config/db.js';

async function performTest() {
  try {
    const bResult = await db.query(
      "SELECT b.booking_id, b.assigned_guide_id, b.total_price, tg.commission_rate " +
      "FROM bookings b " +
      "JOIN tour_guide tg ON b.assigned_guide_id = tg.guide_id " +
      "WHERE b.status IN ('confirmed', 'pending') " +
      "LIMIT 1"
    );

    if (bResult.rows.length === 0) {
      console.log("No candidate bookings found.");
      process.exit(0);
    }

    const booking = bResult.rows[0];
    console.log("Candidate row:", JSON.stringify(booking, null, 2));

    const commissionAmount = parseFloat(booking.total_price) * parseFloat(booking.commission_rate || 0.10);
    console.log(`Calculated Commission: ${commissionAmount}`);

    const updateRes = await db.query(
      "UPDATE bookings SET status = 'completed', commission_amount = $1 WHERE booking_id = $2 RETURNING *",
      [commissionAmount, booking.booking_id]
    );

    console.log("Update result:", JSON.stringify(updateRes.rows[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error Detail:", err);
    process.exit(1);
  }
}

performTest();
