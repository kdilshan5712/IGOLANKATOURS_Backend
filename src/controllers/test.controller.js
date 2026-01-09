import db from "../config/db.js";

export const testDB = async (req, res) => {
  const result = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
  );
  res.json(result.rows);
};
