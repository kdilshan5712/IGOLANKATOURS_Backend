import db from './src/config/db.js';

async function alterSchema() {
  try {
    console.log("Altering schema...");
    await db.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('tourist', 'guide', 'admin', 'superadmin'));
    `);
    console.log("Successfully updated users_role_check constraint");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

alterSchema();
