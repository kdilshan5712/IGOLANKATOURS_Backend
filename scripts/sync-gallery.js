
import db from '../src/config/db.js';
import supabase from '../src/config/supabase.js';

async function listAllFiles(bucketName, path = '') {
    const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path, { limit: 100 });

    if (error) {
        console.error(`❌ Error listing '${bucketName}/${path}':`, error.message);
        return [];
    }

    let files = [];
    for (const item of data) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        if (item.id) { // It's a file
            files.push({
                bucket: bucketName,
                path: fullPath,
                name: item.name
            });
        } else { // It's a folder
            const subFiles = await listAllFiles(bucketName, fullPath);
            files = files.concat(subFiles);
        }
    }
    return files;
}

function isImage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext);
}

function cleanTitle(filename) {
    // Remove extension and replace dashes/underscores with spaces
    let title = filename.split('.').slice(0, -1).join('.');
    title = title.replace(/[-_]/g, ' ');
    // Capitalize first letter of each word
    return title.replace(/\b\w/g, c => c.toUpperCase());
}

async function syncGallery() {
    try {
        console.log("🚀 Starting Gallery Refinement & Synchronization...\n");

        // 1. Clear ALL existing images to ensure perfect sync based on new requirements
        console.log("🧹 Clearing all gallery entries for a fresh start...");
        await db.query("DELETE FROM gallery");
        console.log("🗑️  Gallery table cleared.");

        const bucketsToSync = ['gallery', 'reviews'];
        let totalSynced = 0;
        let totalSkipped = 0;

        for (const bucketName of bucketsToSync) {
            console.log(`\n📦 Processing bucket: ${bucketName}...`);
            const allFiles = await listAllFiles(bucketName);
            
            // Filter logic: Only jpg for 'gallery' bucket, all images for others
            const imageFiles = allFiles.filter(f => {
                if (!isImage(f.name)) return false;
                if (bucketName === 'gallery') {
                    const ext = f.name.split('.').pop().toLowerCase();
                    return ext === 'jpg' || ext === 'jpeg';
                }
                return true;
            });

            console.log(`📸 Found ${imageFiles.length} images matching criteria.`);

            for (const file of imageFiles) {
                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from(file.bucket)
                    .getPublicUrl(file.path);
                
                const imageUrl = publicUrlData.publicUrl;

                // Check if already exists (should be empty now anyway)
                const existing = await db.query("SELECT gallery_id FROM gallery WHERE image_url = $1", [imageUrl]);
                
                if (existing.rows.length === 0) {
                    const title = cleanTitle(file.name);
                    const category = file.bucket === 'reviews' ? 'Traveler Experience' : 'Official';
                    const description = `Image from ${file.bucket}/${file.path}`;

                    await db.query(`
                        INSERT INTO gallery (
                            image_url, 
                            title, 
                            description, 
                            category, 
                            status,
                            display_order
                        ) VALUES ($1, $2, $3, $4, 'active', 
                            (SELECT COALESCE(MAX(display_order), 0) + 1 FROM gallery)
                        )
                    `, [imageUrl, title, description, category]);
                    
                    console.log(` ✅ Synced: ${title}`);
                    totalSynced++;
                } else {
                    totalSkipped++;
                }
            }
        }

        console.log(`\n✨ Refinement Complete!`);
        console.log(`✅ Total Synced: ${totalSynced}`);
        console.log(`⏭️  Total Skipped: ${totalSkipped}`);

    } catch (err) {
        console.error("❌ Sync Error:", err.message);
    } finally {
        process.exit(0);
    }
}

syncGallery();
