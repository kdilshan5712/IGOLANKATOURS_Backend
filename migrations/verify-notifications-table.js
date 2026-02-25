import dotenv from 'dotenv';
dotenv.config();

import db from '../src/config/db.js';

async function verifyNotificationsTable() {
    try {
        console.log('🔍 Verifying notifications table schema...\n');

        // Check if table exists
        const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notifications'
      );
    `);

        if (!tableExists.rows[0].exists) {
            console.log('❌ Notifications table does not exist!');
            console.log('📝 Creating notifications table...\n');

            // Create table
            await db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          link VARCHAR(500),
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP
        );
      `);

            // Create indexes
            await db.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      `);

            console.log('✅ Notifications table created successfully!\n');
        } else {
            console.log('✅ Notifications table exists\n');
        }

        // Verify columns
        const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);

        console.log('📋 Table Schema:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
        });

        // Verify indexes
        const indexes = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'notifications';
    `);

        console.log('\n📊 Indexes:');
        indexes.rows.forEach(idx => {
            console.log(`  - ${idx.indexname}`);
        });

        // Get notification count
        const count = await db.query('SELECT COUNT(*) as count FROM notifications');
        console.log(`\n📈 Total notifications in database: ${count.rows[0].count}`);

        // Get sample notifications
        const sample = await db.query(`
      SELECT notification_id, user_id, type, title, read, created_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT 5
    `);

        if (sample.rows.length > 0) {
            console.log('\n📝 Recent notifications:');
            sample.rows.forEach(notif => {
                console.log(`  - [${notif.type}] ${notif.title} (read: ${notif.read}, ${new Date(notif.created_at).toLocaleString()})`);
            });
        }

        await db.pool.end();
        console.log('\n✅ Verification completed successfully!');

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.error('Details:', error);
        await db.pool.end();
        process.exit(1);
    }
}

verifyNotificationsTable();
