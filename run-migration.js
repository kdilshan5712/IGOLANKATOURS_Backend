import db from './src/config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log("🚀 Starting migration: Deposit System...");
    const sql = fs.readFileSync(path.join(__dirname, 'scripts/migration_deposit_system.sql'), 'utf8');
    
    await db.query(sql);
    console.log("✅ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
