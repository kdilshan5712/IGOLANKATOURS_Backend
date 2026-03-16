import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";
dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkImages() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT package_id, name, image 
      FROM tour_packages;
    `);
    console.log("IMAGES_START");
    res.rows.forEach(row => console.log(JSON.stringify(row)));
    console.log("IMAGES_END");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkImages();
