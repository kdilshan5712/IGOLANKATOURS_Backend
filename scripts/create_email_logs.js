import pool from '../src/config/db.js';

const createEmailLogsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS email_logs (
            log_id SERIAL PRIMARY KEY,
            recipient VARCHAR(255) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(query);
        console.log('✅ email_logs table created or already exists.');
    } catch (error) {
        console.error('❌ Error creating email_logs table:', error.message);
    } finally {
        process.exit();
    }
};

createEmailLogsTable();
