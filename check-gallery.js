import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";
dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkGallery() {
  try {
    await client.connect();
    const res = await client.query(`SELECT * FROM gallery LIMIT 5`);
    console.log("GALLERY_TABLE_START");
    res.rows.forEach(row => console.log(JSON.stringify(row)));
    console.log("GALLERY_TABLE_END");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkGallery();
