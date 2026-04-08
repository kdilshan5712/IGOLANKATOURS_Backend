import db from './src/config/db.js';
const inspect = async () => {
  const res = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings' ORDER BY ordinal_position`);
  console.log(JSON.stringify(res.rows));
  process.exit(0);
};
inspect();
