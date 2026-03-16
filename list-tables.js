import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function listTables() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log("TABLES_START");
    res.rows.forEach(row => console.log(row.table_name));
    console.log("TABLES_END");

    const views = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'VIEW'
      ORDER BY table_name;
    `);
    console.log("VIEWS_START");
    views.rows.forEach(row => console.log(row.table_name));
    console.log("VIEWS_END");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listTables();
