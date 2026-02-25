import dotenv from 'dotenv';
dotenv.config();

import db from '../src/config/db.js';

async function addRefundColumns() {
    try {
        console.log('🔄 Adding refund tracking columns to bookings table...\n');

        // Add columns for cancellation and refund tracking
        await db.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS refund_percentage INTEGER,
      ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) DEFAULT 'pending';
    `);

        console.log('✅ Columns added successfully\n');

        // Add check constraint for refund_status
        await db.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'bookings_refund_status_check'
        ) THEN
          ALTER TABLE bookings
          ADD CONSTRAINT bookings_refund_status_check
          CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed'));
        END IF;
      END $$;
    `);

        console.log('✅ Constraints added successfully\n');

        // Verify columns exist
        const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
        AND (column_name LIKE '%refund%' OR column_name LIKE '%cancel%')
      ORDER BY ordinal_position;
    `);

        console.log('📋 Refund/Cancellation columns in bookings table:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
        });

        await db.pool.end();
        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Details:', error);
        await db.pool.end();
        process.exit(1);
    }
}

addRefundColumns();
