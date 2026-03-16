
import db from '../src/config/db.js';

async function checkGalleryTable() {
  try {
    console.log("🔍 Checking contents of 'gallery' table...");
    const result = await db.query("SELECT * FROM gallery LIMIT 5");
    console.log(`📊 Found ${result.rows.length} rows in gallery table.`);
    if (result.rows.length > 0) {
      console.log("📝 Sample rows:");
      result.rows.forEach(row => {
        console.log(`   - ID: ${row.gallery_id}, URL: ${row.image_url}, Category: ${row.category}`);
      });
    }
    
    const countResult = await db.query("SELECT COUNT(*) FROM gallery");
    console.log(`📈 Total row count: ${countResult.rows[0].count}`);

  } catch (err) {
    console.error("❌ Error checking database:", err.message);
  } finally {
    process.exit(0);
  }
}

checkGalleryTable();
