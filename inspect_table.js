import db from './src/config/db.js';

const checkColumns = async () => {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chatbot_session'
    `);
    console.log('Columns in chatbot_session:');
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkColumns();
