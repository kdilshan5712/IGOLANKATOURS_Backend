/**
 * Create or reset admin user for testing
 */

import db from '../src/config/db.js';
import { hashPassword } from '../src/utils/hash.js';
import crypto from 'crypto';

async function createTestAdmin() {
  try {
    const email = 'admin@gmail.com';
    const password = 'Admin@12345678';
    const hashedPassword = await hashPassword(password);

    console.log('🔧 Checking if admin exists...');
    
    const checkAdmin = await db.query(
      'SELECT user_id, email FROM users WHERE email = $1',
      [email]
    );

    if (checkAdmin.rows.length > 0) {
      const userId = checkAdmin.rows[0].user_id;
      console.log('✅ Admin user exists:', checkAdmin.rows[0].email);
      console.log('📝 Updating password to "Admin@12345678"...');
      
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hashedPassword, email]
      );
      
      // Ensure admin profile exists
      const adminProfileCheck = await db.query(
        'SELECT user_id FROM admin WHERE user_id = $1',
        [userId]
      );
      
      if (adminProfileCheck.rows.length === 0) {
        console.log('📝 Creating admin profile...');
        await db.query(
          'INSERT INTO admin (user_id) VALUES ($1)',
          [userId]
        );
      }
      
      console.log('✅ Admin password updated successfully!');
      console.log('\nTest credentials:');
      console.log('  Email:', email);
      console.log('  Password:', password);
    } else {
      console.log('❌ No admin user found');
      console.log('📝 Creating new admin user...');
      
      const userId = crypto.randomUUID();
      
      await db.query(
        `INSERT INTO users (user_id, email, password_hash, role, status, created_at)
         VALUES ($1, $2, $3, 'admin', 'active', CURRENT_TIMESTAMP)`,
        [userId, email, hashedPassword]
      );
      
      // Create admin profile
      console.log('📝 Creating admin profile...');
      await db.query(
        'INSERT INTO admin (user_id) VALUES ($1)',
        [userId]
      );
      
      console.log('✅ Admin user created successfully!');
      console.log('\nTest credentials:');
      console.log('  Email:', email);
      console.log('  Password:', password);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAdmin();
