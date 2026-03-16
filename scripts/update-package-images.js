
import db from '../src/config/db.js';
import supabase from '../src/config/supabase.js';

async function updatePackageImages() {
  try {
    console.log("🚀 Starting Tour Package image update process...");

    // 1. Fetch all objects from the TOURPACKAGES bucket
    const { data: bucketFiles, error: bucketError } = await supabase.storage
      .from('TOURPACKAGES')
      .list('', { limit: 100 });

    if (bucketError) throw bucketError;
    
    const imageFiles = bucketFiles.filter(f => f.name !== '.emptyFolderPlaceholder');
    console.log(`Found ${imageFiles.length} images in TOURPACKAGES bucket.`);

    // 2. Fetch all tour packages from the database
    const packagesResult = await db.query(`
      SELECT package_id, name 
      FROM tour_packages
    `);
    const packages = packagesResult.rows;
    console.log(`Found ${packages.length} tour packages in database.`);

    let matchedCount = 0;
    let updatedCount = 0;

    // 3. Process each package
    for (const pkg of packages) {
      // Find matching image (case-insensitive, ignore extension)
      const matchingFile = imageFiles.find(file => {
        const fileNameWithoutExt = file.name.split('.').slice(0, -1).join('.');
        return fileNameWithoutExt.toLowerCase() === pkg.name.toLowerCase();
      });

      if (matchingFile) {
        matchedCount++;
        console.log(`\nMatch found for "${pkg.name}": ${matchingFile.name}`);

        // 4. Generate signed URL (5 years = 157,788,000 seconds)
        const fiveYearsInSeconds = 5 * 365 * 24 * 60 * 60;
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('TOURPACKAGES')
          .createSignedUrl(matchingFile.name, fiveYearsInSeconds);

        if (signedUrlError) {
          console.error(`❌ Error generating signed URL for ${pkg.name}:`, signedUrlError.message);
          continue;
        }

        const signedUrl = signedUrlData.signedUrl;

        // 5. Update the database
        await db.query(`
          UPDATE tour_packages 
          SET image = $1, 
              images = ARRAY[$1]::TEXT[]
          WHERE package_id = $2
        `, [signedUrl, pkg.package_id]);

        updatedCount++;
        console.log(`✅ Updated package "${pkg.name}" with signed URL.`);
      } else {
        console.log(`⚠️ No matching image found for package: "${pkg.name}"`);
      }
    }

    console.log(`\n🏁 Process finished.`);
    console.log(`Matched: ${matchedCount}/${packages.length}`);
    console.log(`Updated: ${updatedCount}/${packages.length}`);

  } catch (err) {
    console.error("❌ Fatal Error:", err.message);
  } finally {
    process.exit(0);
  }
}

updatePackageImages();
