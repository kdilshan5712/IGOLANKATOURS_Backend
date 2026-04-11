import db from "./src/config/db.js";

async function migrate() {
  try {
    console.log("🚀 Starting Social Login Migration...");

    // Add google_id and facebook_id columns
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255) UNIQUE;
    `);
    console.log("✅ Added google_id and facebook_id columns");

    // Make password_hash nullable
    await db.query(`
      ALTER TABLE users 
      ALTER COLUMN password_hash DROP NOT NULL;
    `);
    console.log("✅ Made password_hash nullable");

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
