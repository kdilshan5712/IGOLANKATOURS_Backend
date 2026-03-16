
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllFiles(bucketName, path = '') {
    const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path, { limit: 100 });

    if (error) {
        console.error(`❌ Error listing '${bucketName}/${path}':`, error.message);
        return;
    }

    for (const item of data) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        if (item.id) { // It's a file
            console.log(`📄 File: ${bucketName}/${fullPath}`);
        } else { // It's a folder
            console.log(`📂 Folder: ${bucketName}/${fullPath}`);
            await listAllFiles(bucketName, fullPath);
        }
    }
}

async function start() {
    console.log("🔍 Listing 'TOURPACKAGES' recursively...");
    await listAllFiles('TOURPACKAGES');
    console.log("\n✅ Done.");
}

start();
