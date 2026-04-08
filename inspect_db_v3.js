import db from './src/config/db.js';

const inspect = async () => {
  const tables = ['bookings', 'chatbot_session', 'tour_packages', 'tourist', 'users'];
  for (const table of tables) {
    try {
      const res = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      console.log(`\n--- Columns in ${table} ---`);
      res.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type}`);
      });
    } catch (err) {
      console.error(`Error inspecting ${table}:`, err.message);
    }
  }
  process.exit(0);
};

inspect();
