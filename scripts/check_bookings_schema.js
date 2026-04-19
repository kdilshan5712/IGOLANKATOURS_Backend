
import db from '../src/config/db.js';

async function checkSchema() {
  try {
    const result = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'");
    console.log('--- BOOKINGS COLUMNS ---');
    console.log(result.rows.map(r => r.column_name).join(', '));
    
    const sample = await db.query('SELECT * FROM bookings LIMIT 1');
    if (sample.rows.length > 0) {
        console.log('\n--- SAMPLE BOOKING ---');
        console.log(sample.rows[0]);
    }
  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    process.exit();
  }
}

checkSchema();
