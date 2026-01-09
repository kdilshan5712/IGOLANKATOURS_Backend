import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

// Safety check
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Fired when a client is acquired
pool.on("connect", () => {
  console.log("✅ PostgreSQL client acquired");
});

// Handle unexpected pool errors
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL error:", err);
});

// Query helper
const query = async (text, params = []) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error("❌ Database query failed:", err.code || err.message);
    throw err;
  }
};

// 🔥 OPTIONAL BUT RECOMMENDED: warm up connection
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("🔥 Database connection warmed up");
  } catch (err) {
    console.warn(
      "⚠️ Database not reachable at startup (will retry on demand)"
    );
  }
})();

export default {
  pool,
  query
};
