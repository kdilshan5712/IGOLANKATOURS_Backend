
import db from '../src/config/db.js';

async function checkEmailLogs() {
  try {
    const result = await db.query('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10');
    console.log('--- EMAIL LOGS ---');
    console.table(result.rows);
    
    const errors = await db.query("SELECT * FROM email_logs WHERE status = 'failed' ORDER BY sent_at DESC LIMIT 5");
    if (errors.rows.length > 0) {
      console.log('\n--- RECENT FAILURES ---');
      console.table(errors.rows);
    }
  } catch (err) {
    console.error('Error checking logs:', err);
  } finally {
    process.exit();
  }
}

checkEmailLogs();
