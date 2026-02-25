// Apply guide_availability table migration
import dotenv from 'dotenv';
dotenv.config();

import db from '../src/config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  try {
    console.log('📦 Creating guide_availability table...\n');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-guide-availability.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await db.query(sql);
    
    console.log('✅ guide_availability table created successfully!');
    console.log('✅ Indexes created');
    console.log('✅ Constraints applied\n');
    
    // Verify the table was created
    const checkResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'guide_availability'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table structure:');
    checkResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n🎉 Migration completed successfully!');
    
    await db.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();
