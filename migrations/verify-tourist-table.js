import dotenv from 'dotenv';
dotenv.config();

import db from '../src/config/db.js';

async function verifyTouristTable() {
    try {
        console.log('🔍 Verifying tourist table schema...\n');

        // Verify columns
        const columns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tourist'
      ORDER BY ordinal_position;
    `);

        console.log('📋 Tourist Table Schema:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        await db.pool.end();
        console.log('\n✅ Verification completed successfully!');

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        await db.pool.end();
        process.exit(1);
    }
}

verifyTouristTable();
