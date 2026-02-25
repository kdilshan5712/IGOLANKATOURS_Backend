import pool from '../src/config/db.js';

async function migrate() {
    console.log('🚀 Running chat authorization migration...');

    const client = await pool.pool.connect();
    try {
        await client.query('BEGIN');

        // Add is_chat_authorized column to bookings table
        await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'bookings' AND column_name = 'is_chat_authorized'
        ) THEN
          ALTER TABLE bookings ADD COLUMN is_chat_authorized BOOLEAN DEFAULT FALSE;
        END IF;
      END $$
    `);
        console.log('✅ bookings.is_chat_authorized column ensured');

        await client.query('COMMIT');
        console.log('\n🎉 Migration complete!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        console.error('Detail:', err.detail || '');
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
