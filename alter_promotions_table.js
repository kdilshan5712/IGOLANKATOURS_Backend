import db from "./src/config/db.js";

const alterTable = async () => {
  try {
    await db.query(`
      ALTER TABLE promotions 
      ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0 
      CHECK (discount_percentage >= 0 AND discount_percentage <= 100);
    `);
    console.log("✅ Added discount_percentage to promotions table!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to alter table:", error);
    process.exit(1);
  }
};

alterTable();
