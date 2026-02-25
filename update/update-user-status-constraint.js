import db from '../src/config/db.js';

async function updateConstraint() {
    try {
        console.log("Started updating users table constraint...");

        // Drop the existing constraint
        await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;`);

        // Add the new constraint including 'rejected'
        await db.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_status_check 
      CHECK (status IN ('active', 'inactive', 'blocked', 'pending', 'rejected'));
    `);

        console.log("✅ Successfully updated users_status_check constraint to include 'rejected'.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error updating constraint:", err.message);
        process.exit(1);
    }
}

updateConstraint();
