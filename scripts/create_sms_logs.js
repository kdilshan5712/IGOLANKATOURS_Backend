import pool from '../src/config/db.js';

const createSmsLogsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS sms_logs (
            log_id SERIAL PRIMARY KEY,
            recipient_phone VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(50),
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(query);
        console.log('✅ sms_logs table created or already exists.');
    } catch (error) {
        console.error('❌ Error creating sms_logs table:', error.message);
    } finally {
        process.exit();
    }
};

createSmsLogsTable();
