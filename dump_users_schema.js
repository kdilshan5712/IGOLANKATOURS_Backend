import db from "./src/config/db.js";
import fs from "fs";

async function dumpUsersSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    fs.writeFileSync("users_schema.json", JSON.stringify(result.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error dumping schema:", err);
    process.exit(1);
  }
}

dumpUsersSchema();
