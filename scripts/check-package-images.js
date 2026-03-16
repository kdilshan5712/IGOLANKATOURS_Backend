
import db from '../src/config/db.js';

async function checkTourPackages() {
  try {
    console.log("🔍 Checking tour packages in database...");
    const result = await db.query("SELECT package_id, name, image, images FROM tour_packages");
    console.log(`📊 Found ${result.rows.length} tour packages.`);
    
    const missing = result.rows.filter(r => !r.image || r.image.includes('placeholder') || r.image === '');
    console.log(`⚠️ ${missing.length} packages are missing real main images:`);
    missing.forEach(p => {
      console.log(`   - [${p.package_id}] ${p.name} (Current: ${p.image})`);
    });

    const missingGallery = result.rows.filter(r => !r.images || r.images.length === 0);
    console.log(`\n⚠️ ${missingGallery.length} packages are missing gallery images:`);
    missingGallery.forEach(p => {
      console.log(`   - [${p.package_id}] ${p.name}`);
    });

  } catch (err) {
    console.error("❌ Error checking database:", err.message);
  } finally {
    process.exit(0);
  }
}

checkTourPackages();
