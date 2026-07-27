/**
 * Fix bookings_status_check constraint
 * Queries the current constraint definition and drops/recreates it
 * to include 'pending' as a valid status.
 */
import db from '../src/config/db.js';

async function fixStatusConstraint() {
  try {
    // 1. Query current constraint definition
    const constraintRes = await db.query(`
      SELECT pg_get_constraintdef(c.oid) AS constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'bookings'
        AND c.conname = 'bookings_status_check'
    `);

    if (constraintRes.rows.length > 0) {
      console.log('Current constraint:', constraintRes.rows[0].constraint_def);
    } else {
      console.log('No bookings_status_check constraint found!');
    }

    // 2. Check current valid statuses in the table
    const statusRes = await db.query(`SELECT DISTINCT status FROM bookings ORDER BY status`);
    console.log('Existing status values in DB:', statusRes.rows.map(r => r.status));

    // 3. Drop old constraint
    console.log('\nDropping old constraint...');
    await db.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`);

    // 4. Recreate with full set of valid statuses including 'pending'
    console.log('Creating new constraint with pending, confirmed, cancelled, completed, in_progress...');
    await db.query(`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_status_check 
      CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'in_progress'))
    `);

    // 5. Also fix payment_status if needed
    const paymentConstraintRes = await db.query(`
      SELECT pg_get_constraintdef(c.oid) AS constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'bookings'
        AND c.conname LIKE '%payment_status%'
    `);
    if (paymentConstraintRes.rows.length > 0) {
      console.log('\nPayment status constraint:', paymentConstraintRes.rows[0].constraint_def);
    }

    // Drop and recreate payment_status constraint to include 'pending'
    await db.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check`);
    await db.query(`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_payment_status_check 
      CHECK (payment_status IN ('pending', 'paid', 'partial', 'refunded', 'failed'))
    `);

    console.log('\n✅ Constraints updated successfully!');
    console.log('Valid statuses: pending, confirmed, cancelled, completed, in_progress');
    console.log('Valid payment statuses: pending, paid, partial, refunded, failed');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixStatusConstraint();
