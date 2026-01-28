import { createClient } from "@supabase/supabase-js";

// Safety check for required environment variables
if (!process.env.SUPABASE_URL) {
  console.error("❌ SUPABASE_URL is not defined");
  process.exit(1);
}

// Support both SUPABASE_KEY and SUPABASE_SERVICE_ROLE_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.error("❌ SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY is not defined");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey,
  {
    auth: {
      persistSession: false
    }
  }
);

console.log("✅ Supabase client initialized");

export default supabase;
