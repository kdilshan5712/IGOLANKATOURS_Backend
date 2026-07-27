import db from './src/config/db.js';

async function checkSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reviews';
    `);
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
