import pool from '../src/config/db.js';

async function checkEmailLogs() {
    try {
        console.log('Querying email_logs table info...');
        const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'email_logs'");
        console.log('Columns:', columns.rows.map(r => r.column_name));

        const logs = await pool.query("SELECT * FROM email_logs ORDER BY 1 DESC LIMIT 10");
        console.log('Recent logs:', JSON.stringify(logs.rows, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkEmailLogs();
