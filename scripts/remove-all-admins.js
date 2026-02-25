/**
 * Remove all admin users from database
 * WARNING: This will delete all admin accounts!
 */

import db from '../src/config/db.js';

async function removeAllAdmins() {
  try {
    console.log('⚠️  WARNING: This will delete ALL admin accounts from the database!\n');
    console.log('Proceeding with deletion...\n');

    // Get all admin users first
    const adminsResult = await db.query(
      `SELECT u.user_id, u.email 
       FROM users u 
       WHERE u.role = 'admin'`
    );

    if (adminsResult.rows.length === 0) {
      console.log('ℹ️  No admin users found in database.');
      process.exit(0);
    }

    console.log(`Found ${adminsResult.rows.length} admin user(s):\n`);
    adminsResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.email}`);
    });
    console.log('\n');

    const adminIds = adminsResult.rows.map(row => row.user_id);

    // Delete from admin table
    console.log('🗑️  Deleting admin profiles...');
    const deleteAdminResult = await db.query(
      `DELETE FROM admin WHERE user_id = ANY($1)`,
      [adminIds]
    );
    console.log(`✅ Deleted ${deleteAdminResult.rowCount} admin profile(s)\n`);

    // Delete from users table
    console.log('🗑️  Deleting admin users...');
    const deleteUsersResult = await db.query(
      `DELETE FROM users WHERE user_id = ANY($1)`,
      [adminIds]
    );
    console.log(`✅ Deleted ${deleteUsersResult.rowCount} admin user(s)\n`);

    // Verify deletion
    const verifyResult = await db.query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
    );

    if (verifyResult.rows[0].count === 0) {
      console.log('✅ All admins successfully removed from database!');
    } else {
      console.log(`⚠️  ${verifyResult.rows[0].count} admin(s) still remain in database.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeAllAdmins();
