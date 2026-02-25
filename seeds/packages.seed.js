import db from "../src/config/db.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to determine Season and Coast type
const getSeasonAndCoast = (pkg, description) => {
  const text = (pkg.name + " " + description).toLowerCase();

  if (text.includes("east") || text.includes("arugam") || text.includes("trinco") || text.includes("batticaloa") || text.includes("pigeon island") || text.includes("pasikudah")) {
    return { season_type: 'east', coast_type: 'east' };
  }
  if (text.includes("south") || text.includes("galle") || text.includes("mirissa") || text.includes("unawatuna") || text.includes("bentota") || text.includes("yala") || text.includes("tangalle") || text.includes("hikkaduwa") || text.includes("weligama")) {
    return { season_type: 'south', coast_type: 'south' };
  }
  if (text.includes("kandy") || text.includes("sigiriya") || text.includes("cultural") || text.includes("anuradhapura") || text.includes("polonnaruwa") || text.includes("dambulla")) {
    return { season_type: 'year_round', coast_type: 'inland' };
  }
  if (text.includes("ella") || text.includes("nuwara") || text.includes("tea") || text.includes("mountain") || text.includes("horton") || text.includes("peak")) {
    return { season_type: 'year_round', coast_type: 'hills' };
  }
  return { season_type: 'year_round', coast_type: 'mixed' };
};

// Keyword-based Image Mapping
const getImageForPackage = (text) => {
  const t = text.toLowerCase();
  if (t.includes('sigiriya') || t.includes('lion rock')) return "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070";
  if (t.includes('yala') || t.includes('safari') || t.includes('leopard') || t.includes('wildlife')) return "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2070";
  if (t.includes('kandy') || t.includes('tooth')) return "https://images.unsplash.com/photo-1588392382834-a891154bca4d?q=80&w=2070";
  if (t.includes('ella') || t.includes('nine arch') || t.includes('mountain') || t.includes('hill')) return "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070"; // Need Ella image
  if (t.includes('galle') || t.includes('fort')) return "https://images.unsplash.com/photo-1551028719-00167b16ebc5?q=80&w=2070";
  if (t.includes('beach') || t.includes('mirissa') || t.includes('hikkaduwa') || t.includes('bentota') || t.includes('trinco')) return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2070";
  if (t.includes('nuwara') || t.includes('tea')) return "https://images.unsplash.com/photo-1464207687429-7505649dae38?q=80&w=2070";
  if (t.includes('culture') || t.includes('temple')) return "https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=2070";

  return "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2070"; // Generic nature
};

// Keyword-based Category Inference
const getCategory = (text) => {
  const t = text.toLowerCase();
  if (t.includes('honeymoon')) return 'Honeymoon';
  if (t.includes('wildlife') || t.includes('safari') || t.includes('yala') || t.includes('bird')) return 'Wildlife';
  if (t.includes('adventure') || t.includes('trek') || t.includes('rafting') || t.includes('hiking')) return 'Adventure';
  if (t.includes('beach') || t.includes('surf') || t.includes('ocean') || t.includes('sea')) return 'Beach';
  if (t.includes('culture') || t.includes('heritage') || t.includes('history') || t.includes('temple') || t.includes('ancient')) return 'Cultural';
  if (t.includes('luxury') || t.includes('premium')) return 'Luxury';
  if (t.includes('family')) return 'Family';
  return 'Tour';
};

async function seedPackages() {
  try {
    console.log("🌱 Starting package seed migration...");

    // 1. Read tours.json
    const toursPath = path.join(__dirname, '..', 'tours.json');
    if (!fs.existsSync(toursPath)) {
      throw new Error("tours.json not found in root!");
    }
    const content = fs.readFileSync(toursPath, 'utf8');

    // Fix concatenated JSON format: } { -> }, {
    const fixedContent = '[' + content.replace(/}\s*{/g, '},{') + ']';

    let allPackages = [];
    try {
      const envelopes = JSON.parse(fixedContent);
      allPackages = envelopes.flatMap(e => e.packages);
    } catch (e) {
      console.log('Concatenated parse failed, trying standard parse...');
      const data = JSON.parse(content);
      allPackages = data.packages || [];
    }

    console.log(`Found ${allPackages.length} packages in tours.json`);

    // 2. Clear existing data
    console.log("⚠️ Deleting existing packages...");
    await db.query("DELETE FROM tour_packages");
    console.log("✅ Existing packages deleted.");

    // 3. Process and Insert
    for (const pkg of allPackages) {
      // Generate fields
      const duration = `${pkg.duration_days} Days`;

      const destinationNames = pkg.destinations.map(d => d.location).join(', ');
      const description = `${pkg.name} is a ${duration} tour starting from ${pkg.start_location}. Visit ${destinationNames}.`;
      const fullDescription = `${pkg.name} offers an unforgettable journey through Sri Lanka. Starting from ${pkg.start_location}, you will explore ${destinationNames}, staying at top-rated hotels. Return to ${pkg.return_to}.`;

      const category = getCategory(pkg.name + " " + destinationNames);
      const image = getImageForPackage(pkg.name + " " + destinationNames);
      const { season_type, coast_type } = getSeasonAndCoast(pkg, description);

      const highlights = JSON.stringify(pkg.destinations.flatMap(d => d.activities).slice(0, 6)); // First 6 activities
      const included = JSON.stringify(["Accommodation", "Breakfast", "Transportation", "Guide", "All government taxes"]);
      const excludes = JSON.stringify(["Lunch & Dinner", "Entrance Fees", "Tips", "Personal Expenses"]);

      const result = await db.query(
        `INSERT INTO tour_packages 
        (name, description, full_description, highlights, includes, excludes, base_price, duration, category, budget, hotel, rating, image, is_active, season_type, coast_type, itinerary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING package_id`,
        [
          pkg.name,
          description,
          fullDescription,
          highlights,
          included,
          excludes,
          pkg.price_per_adult_double,
          duration,
          category,
          "mid", // Default budget
          "3-star +", // Default hotel text (can be refined from destinations)
          4.8, // Default rating
          image,
          true,
          season_type,
          coast_type,
          JSON.stringify(pkg.destinations) // Store the raw destinations array as itinerary
        ]
      );

      console.log(`✅ ${pkg.package_number}. ${pkg.name} - ID: ${result.rows[0].package_id} [${category}]`);
    }

    console.log(`\n🎉 Successfully migrated ${allPackages.length} packages!`);

    // Get statistics
    const stats = await db.query(`
      SELECT category, COUNT(*) as count, AVG(base_price) as avg_price
      FROM tour_packages
      GROUP BY category
      ORDER BY category
    `);

    console.log("\n📊 Package Statistics:");
    console.log(stats.rows);

    process.exit(0);

  } catch (error) {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  }
}

seedPackages();
