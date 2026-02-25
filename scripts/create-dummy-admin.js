/**
 * Create dummy admin users for testing
 */

import db from '../src/config/db.js';
import { hashPassword } from '../src/utils/hash.js';
import crypto from 'crypto';

async function createDummyAdmins() {
  try {
    const admins = [
      { email: 'admin1@test.com', password: 'Test@12345678' },
      { email: 'admin2@test.com', password: 'Test@12345678' },
      { email: 'demo@igolankatours.com', password: 'Demo@12345678' }
    ];

    console.log('📝 Creating dummy admin accounts...\n');

    for (const admin of admins) {
      const hashedPassword = await hashPassword(admin.password);

      // Check if admin exists
      const checkAdmin = await db.query(
        'SELECT user_id FROM users WHERE email = $1',
        [admin.email]
      );

      if (checkAdmin.rows.length > 0) {
        const userId = checkAdmin.rows[0].user_id;
        console.log(`⚠️  ${admin.email} already exists, updating password...`);
        
        await db.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [hashedPassword, admin.email]
        );

        // Ensure admin profile exists
        const adminProfileCheck = await db.query(
          'SELECT user_id FROM admin WHERE user_id = $1',
          [userId]
        );
        
        if (adminProfileCheck.rows.length === 0) {
          await db.query(
            'INSERT INTO admin (user_id) VALUES ($1)',
            [userId]
          );
        }
      } else {
        const userId = crypto.randomUUID();
        console.log(`✅ Creating: ${admin.email}`);
        
        // Create user
        await db.query(
          `INSERT INTO users (user_id, email, password_hash, role, status, created_at)
           VALUES ($1, $2, $3, 'admin', 'active', CURRENT_TIMESTAMP)`,
          [userId, admin.email, hashedPassword]
        );
        
        // Create admin profile
        await db.query(
          'INSERT INTO admin (user_id) VALUES ($1)',
          [userId]
        );
      }

      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: ${admin.password}\n`);
    }

    console.log('✅ All dummy admins created/updated successfully!\n');
    console.log('📋 You can now login with any of these credentials:');
    console.log('   - admin1@test.com / Test@12345678');
    console.log('   - admin2@test.com / Test@12345678');
    console.log('   - demo@igolankatours.com / Demo@12345678\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createDummyAdmins();
