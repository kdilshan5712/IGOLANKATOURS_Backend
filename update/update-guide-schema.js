import db from '../src/config/db.js';

async function updateSchema() {
    try {
        console.log("Started updating tour_guide schema...");

        // Add rejection_reason column
        await db.query(`
      ALTER TABLE tour_guide 
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(user_id);
    `);

        console.log("✅ Successfully added rejection columns to tour_guide table.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error updating schema:", err.message);
        process.exit(1);
    }
}

updateSchema();
