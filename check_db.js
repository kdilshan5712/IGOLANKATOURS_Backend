import db from "./src/config/db.js";

async function verify() {
  try {
    console.log("🔍 Checking audit_logs table...");
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'audit_logs'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("✅ Table 'audit_logs' exists.");
      const count = await db.query("SELECT COUNT(*) FROM audit_logs");
      console.log(`📊 Current log count: ${count.rows[0].count}`);
    } else {
      console.log("❌ Table 'audit_logs' does NOT exist!");
    }
  } catch (err) {
    console.error("❌ Error verifying table:", err.message);
  } finally {
    process.exit();
  }
}

verify();
