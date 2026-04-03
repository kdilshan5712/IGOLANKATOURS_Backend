import db from './src/config/db.js';

const inspectSchemas = async () => {
  try {
    console.log('--- Table: users ---');
    const usersCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log(JSON.stringify(usersCols.rows, null, 2));

    console.log('\n--- Table: tourist ---');
    const touristCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tourist'");
    console.log(JSON.stringify(touristCols.rows, null, 2));

    console.log('\n--- Foreign Key Constraint: chatbot_session_tourist_id_fkey ---');
    const fkInfo = await db.query(`
      SELECT
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.key_column_usage AS kcu
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = kcu.constraint_name
      WHERE kcu.constraint_name = 'chatbot_session_tourist_id_fkey';
    `);
    console.log(JSON.stringify(fkInfo.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

inspectSchemas();
