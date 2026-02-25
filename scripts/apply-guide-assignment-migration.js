/**
 * Apply Guide Assignment Migration
 * Adds columns to bookings table for tracking guide assignments
 */

import db from '../src/config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  try {
    console.log('🔄 Starting guide assignment migration...\n');
    
    const sqlPath = join(__dirname, 'add-guide-assignment-columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Columns added:');
    console.log('   - assigned_guide_id (UUID)');
    console.log('   - guide_assigned_at (TIMESTAMP)');
    console.log('   - guide_assigned_by (UUID)');
    console.log('   - admin_notes (TEXT)');
    console.log('\n✨ Guide assignment feature is now ready!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
