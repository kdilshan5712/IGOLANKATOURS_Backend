/**
 * One-time cleanup script: Remove ghost bookings that were created with
 * status='confirmed' but payment_status='pending' (never paid).
 *
 * These were created by a now-fixed bug where bookings were inserted into the
 * DB as 'confirmed' before PayHere payment was completed.
 *
 * Run: node scripts/cleanup-ghost-bookings.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanupGhostBookings() {
  const client = await pool.connect();
  try {
    // Step 1: Preview what will be deleted
    const preview = await client.query(`
      SELECT 
        booking_id,
        status,
        payment_status,
        total_price,
        created_at
      FROM bookings
      WHERE status = 'confirmed' AND payment_status = 'pending'
      ORDER BY created_at DESC
    `);

    if (preview.rows.length === 0) {
      console.log('✅ No ghost bookings found. Database is clean.');
      return;
    }

    console.log(`\n🔍 Found ${preview.rows.length} ghost booking(s) to delete:\n`);
    console.table(preview.rows.map(r => ({
      booking_id: r.booking_id,
      status: r.status,
      payment_status: r.payment_status,
      total_price: r.total_price,
      created_at: new Date(r.created_at).toLocaleString()
    })));

    // Step 2: Delete all ghost bookings
    const result = await client.query(`
      DELETE FROM bookings
      WHERE status = 'confirmed' AND payment_status = 'pending'
      RETURNING booking_id
    `);

    console.log(`\n🗑️  Deleted ${result.rows.length} ghost booking(s) successfully.`);
    console.log('✅ Database cleanup complete. User dashboard will now be clean.');

  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupGhostBookings();
