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
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000, // 60 seconds for Supabase cold starts
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Additional settings for better reliability
  allowExitOnIdle: false,
  application_name: 'igor_backend',
});

// Fired when a client is acquired - set statement timeout here
pool.on("connect", (client) => {
  client.query("SET statement_timeout = 60000"); // 60 seconds query timeout
  console.log("✅ PostgreSQL client acquired");
});

// Handle unexpected pool errors
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL error:", err.message || err);
});

// Query helper with aggressive retry logic for cold starts
const query = async (text, params = [], retries = 3) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      // Log successful connection after retries
      if (attempt > 0) {
        console.log(`✅ Database connection successful after ${attempt} retry/ies`);
      }
      return result;
    } catch (err) {
      const isConnectionError =
        err.message?.includes('timeout') ||
        err.message?.includes('terminated') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('connect') ||
        err.message?.includes('getaddrinfo') ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ENOTFOUND' ||
        err.code === '57P01' || // Postgres termination error
        err.code === '08003' || // connection does not exist
        err.code === '08006'; // connection failure

      // If it's a connection error and we have retries left, try again
      if (isConnectionError && attempt < retries) {
        const waitTime = Math.min(5000 * (attempt + 1), 15000); // Progressive backoff: 5s, 10s, 15s
        console.warn(`⚠️ Database connection issue (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
        console.warn(`   Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // If not a connection error OR no more retries, throw the error
      const errorMsg = err.message || JSON.stringify(err);
      console.error("❌ Database query failed:", err.code || errorMsg);
      throw err;
    }
  }
};

// 🔥 OPTIONAL BUT RECOMMENDED: warm up connection on startup
(async () => {
  try {
    console.log("🔥 Warming up database connection...");

    // Use a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Warmup timeout after 60s')), 60000)
    );

    const queryPromise = pool.query("SELECT NOW()");
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const currentTime = result.rows[0].now;

    console.log(`✅ Database connection warmed up at ${currentTime}`);
  } catch (err) {
    console.error(`\n❌ DATABASE CONNECTION FAILED`);
    console.error(`   Error: ${err.message}`);
    console.error(`\n⚠️  Possible causes:`);
    console.error(`   1. Supabase project is PAUSED or SUSPENDED`);
    console.error(`   2. DATABASE_URL credentials in .env are invalid`);
    console.error(`   3. Database server is down`);
    console.error(`\n📝 Next steps:`);
    console.error(`   1. Run: node diagnose-database.js`);
    console.error(`   2. Check: https://supabase.com/dashboard`);
    console.error(`   3. Reactivate project or create new one`);
    console.error(`   4. Update DATABASE_URL in .env file`);
    console.error(`   5. Restart server after fix\n`);
    console.warn("   Will retry on first application request");
  }
})();

export default {
  pool,
  query
};
