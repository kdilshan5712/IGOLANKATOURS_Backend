import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });
import db from '../src/config/db.js';
import supabase from '../src/config/supabase.js';

async function listAllFiles(bucketName, path = '') {
    let allFiles = [];
    let offset = 0;
    const limit = 100;
    
    while (true) {
        const { data, error } = await supabase.storage
            .from(bucketName)
            .list(path, { 
                limit, 
                offset,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (error) {
            console.error(`❌ Error listing '${bucketName}/${path}':`, error.message);
            break;
        }

        if (!data || data.length === 0) break;

        for (const item of data) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            if (item.id) { // It's a file
                allFiles.push({
                    bucket: bucketName,
                    path: fullPath,
                    name: item.name
                });
            } else { // It's a folder
                const subFiles = await listAllFiles(bucketName, fullPath);
                allFiles = allFiles.concat(subFiles);
            }
        }

        if (data.length < limit) break;
        offset += limit;
    }
    return allFiles;
}

function isImage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext);
}

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function syncPackageImages() {
    try {
        console.log("🚀 Starting Tour Package Image Synchronization (Improved)...\n");

        // 1. Get all packages
        const packages = await db.query("SELECT package_id, name, image, images FROM tour_packages");
        console.log(`📊 Found ${packages.rows.length} packages in DB.`);

        // 2. Get all images in TOURPACKAGES bucket
        const bucketImages = await listAllFiles('TOURPACKAGES');
        const imageFiles = bucketImages.filter(f => isImage(f.name));
        console.log(`📸 Found ${imageFiles.length} images in TOURPACKAGES bucket.`);

        let updatedMain = 0;
        let updatedGallery = 0;

        const FIVE_YEARS_IN_SECONDS = 5 * 365 * 24 * 60 * 60; // 157,680,000

        for (const pkg of packages.rows) {
            const pkgNameNorm = normalize(pkg.name);
            console.log(`🔍 Searching match for: "${pkg.name}" (${pkgNameNorm})`);
            
            // Find best matches
            const matches = imageFiles.filter(f => {
                const fileNameNorm = normalize(f.name.split('.')[0]);
                return fileNameNorm === pkgNameNorm || fileNameNorm.includes(pkgNameNorm) || pkgNameNorm.includes(fileNameNorm);
            });

            if (matches.length > 0) {
                // Use the first match as main image
                const mainMatch = matches[0];
                const { data: signedUrlData, error: signedError } = await supabase.storage
                    .from(mainMatch.bucket)
                    .createSignedUrl(mainMatch.path, FIVE_YEARS_IN_SECONDS);
                
                if (signedError) {
                    console.error(` ❌ Error creating signed URL for ${mainMatch.path}:`, signedError.message);
                    continue;
                }
                
                const imageUrl = signedUrlData.signedUrl;

                if (pkg.image !== imageUrl) {
                    await db.query("UPDATE tour_packages SET image = $1 WHERE package_id = $2", [imageUrl, pkg.package_id]);
                    console.log(` ✅ Updated Main Image (Signed 5Y): ${imageUrl.substring(0, 100)}...`);
                    updatedMain++;
                }

                // Update gallery with ALL matched images (as signed URLs)
                let gallery = []; // Start fresh to ensure all are signed and valid
                let galleryUpdated = false;

                for (const match of matches) {
                    const { data: sUrlData, error: sError } = await supabase.storage
                        .from(match.bucket)
                        .createSignedUrl(match.path, FIVE_YEARS_IN_SECONDS);
                    
                    if (sError) {
                        console.error(` ❌ Error creating signed gallery URL:`, sError.message);
                        continue;
                    }
                    
                    gallery.push(sUrlData.signedUrl);
                    galleryUpdated = true;
                }

                if (galleryUpdated) {
                    await db.query("UPDATE tour_packages SET images = $1 WHERE package_id = $2", [gallery, pkg.package_id]);
                    console.log(` 🖼️  Updated Gallery (${gallery.length} signed URLs)`);
                    updatedGallery++;
                }
            } else {
                console.log(` ❓ No match found.`);
            }
        }

        console.log(`\n✨ Sync Complete!`);
        console.log(`✅ Main images updated: ${updatedMain}`);
        console.log(`🖼️  Gallery additions: ${updatedGallery}`);

    } catch (err) {
        console.error("❌ Sync Error:", err.message);
    } finally {
        process.exit(0);
    }
}

syncPackageImages();
