import db from './src/config/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });

async function testUpdate() {
    try {
        console.log("🧪 Testing manual update...");
        const pkg = await db.query("SELECT package_id, name, image FROM tour_packages LIMIT 1");
        if (pkg.rows.length === 0) return;
        
        const { package_id, name, image } = pkg.rows[0];
        console.log(`Current for ${name}: ${image}`);
        
        const testUrl = "https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/public/TOURPACKAGES/Adventure.png";
        
        await db.query("UPDATE tour_packages SET image = $1 WHERE package_id = $2", [testUrl, package_id]);
        console.log("✅ Update successful!");
        
        const updated = await db.query("SELECT image FROM tour_packages WHERE package_id = $1", [package_id]);
        console.log(`New value: ${updated.rows[0].image}`);

    } catch (err) {
        console.error("❌ Update failed:", err);
    } finally {
        process.exit(0);
    }
}

testUpdate();
