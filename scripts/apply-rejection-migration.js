// Apply migration to add rejection tracking fields
import dotenv from 'dotenv';
dotenv.config();

import db from '../src/config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running migration to add rejection tracking fields...\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'add-rejection-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute migration
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify columns were added
    const result = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tour_guide'
      AND column_name IN ('rejection_reason', 'rejected_at', 'rejected_by', 'approved_at', 'approved_by')
      ORDER BY column_name;
    `);
    
    console.log('📊 New columns added:');
    result.rows.forEach((col) => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n🎉 Database schema updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
