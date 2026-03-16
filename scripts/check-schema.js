
import db from '../src/config/db.js';

async function checkSchema() {
  try {
    console.log("🔍 Checking schema of 'tour_packages' table...");
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tour_packages'
    `);
    
    console.log("📊 Columns in 'tour_packages':");
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

  } catch (err) {
    console.error("❌ Error checking schema:", err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
