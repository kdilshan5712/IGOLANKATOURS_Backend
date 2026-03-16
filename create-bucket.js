import db from './src/config/db.js';

async function createBucket() {
    try {
        console.log("Checking storage connection...");

        // First check if the storage schema exists
        const schemaCheck = await db.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'storage'
    `);

        if (schemaCheck.rows.length === 0) {
            console.log("Storage schema not found. You might not have Supabase Storage enabled or sufficient privileges.");
            process.exit(1);
        }

        console.log("Creating 'reviews' bucket...");

        await db.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('reviews', 'reviews', true) 
      ON CONFLICT (id) DO NOTHING;
    `);

        // Add security policies to allow public read
        await db.query(`
      CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'reviews');
    `).catch(err => console.log("Policy might already exist:", err.message));

        // Allow authenticated inserts
        await db.query(`
      CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reviews');
    `).catch(err => console.log("Policy might already exist:", err.message));

        console.log("✅ 'reviews' bucket created successfully!");

    } catch (err) {
        console.error("❌ Failed to create bucket:", err.message);
    } finally {
        process.exit(0);
    }
}

createBucket();
