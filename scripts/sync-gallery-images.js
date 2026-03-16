import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });
import db from '../src/config/db.js';
import supabase from '../src/config/supabase.js';

async function syncGalleryImages() {
    try {
        console.log("🚀 Starting Gallery Image Synchronization (5-Year Signed URLs)...\n");

        // 1. Get all gallery records
        const { rows } = await db.query("SELECT gallery_id, image_url, title FROM gallery");
        console.log(`📊 Found ${rows.length} gallery records in DB.`);

        const FIVE_YEARS_IN_SECONDS = 5 * 365 * 24 * 60 * 60; // 157,680,000
        let updatedCount = 0;

        for (const row of rows) {
            // Extract filename from the URL
            // Example URL: https://.../storage/v1/object/public/gallery/IMG-20260209-WA0091.jpg
            const urlParts = row.image_url.split('/');
            const fileName = urlParts[urlParts.length - 1];

            console.log(`🔍 Processing: ${fileName} (${row.title || 'No Title'})`);

            // Generate signed URL
            const { data, error } = await supabase.storage
                .from('gallery')
                .createSignedUrl(fileName, FIVE_YEARS_IN_SECONDS);

            if (error) {
                console.error(` ❌ Error creating signed URL for ${fileName}:`, error.message);
                continue;
            }

            const signedUrl = data.signedUrl;

            // Update database
            await db.query("UPDATE gallery SET image_url = $1 WHERE gallery_id = $2", [signedUrl, row.gallery_id]);
            updatedCount++;
            console.log(` ✅ Updated to: ${signedUrl.substring(0, 100)}...`);
        }

        console.log(`\n✨ Sync Complete!`);
        console.log(`✅ Gallery images updated: ${updatedCount}`);

    } catch (err) {
        console.error("❌ Sync Error:", err.message);
    } finally {
        process.exit(0);
    }
}

syncGalleryImages();
