import db from '../src/config/db.js';

/**
 * Update sample packages with itinerary and images
 * Run with: node seeds/update-packages-with-details.js
 */

async function updatePackagesWithDetails() {
  try {
    console.log('🔄 Updating packages with itinerary and images...\n');

    // Sample itinerary for Cultural Heritage Tour
    const culturalItinerary = [
      {
        day: 1,
        title: "Arrival in Colombo",
        description: "Meet and greet at Bandaranaike International Airport. Transfer to Colombo hotel. Evening city tour visiting Gangaramaya Temple, Independence Square, and Galle Face Green.",
        locations: ["Colombo", "Gangaramaya Temple", "Galle Face"]
      },
      {
        day: 2,
        title: "Colombo to Sigiriya",
        description: "Journey to Sigiriya. En route visit Dambulla Cave Temple with ancient Buddhist murals. Afternoon climb to Sigiriya Rock Fortress (UNESCO Site). Watch sunset from the summit.",
        locations: ["Dambulla", "Sigiriya"]
      },
      {
        day: 3,
        title: "Ancient City of Polonnaruwa",
        description: "Full day exploration of Polonnaruwa ancient city. Visit Gal Vihara rock sculptures, Royal Palace, and Parakrama Samudra reservoir. Evening village tour with bullock cart ride.",
        locations: ["Polonnaruwa"]
      },
      {
        day: 4,
        title: "Sigiriya to Kandy",
        description: "Drive to Kandy through scenic hill country. Visit spice garden in Matale. Afternoon tour of Temple of the Tooth Relic. Evening cultural dance performance.",
        locations: ["Matale", "Kandy"]
      },
      {
        day: 5,
        title: "Kandy & Surroundings",
        description: "Morning visit to Royal Botanical Gardens in Peradeniya. Traditional Sri Lankan cooking class. Afternoon tea plantation visit and factory tour.",
        locations: ["Peradeniya", "Tea Plantation"]
      },
      {
        day: 6,
        title: "Kandy to Galle",
        description: "Scenic train journey to coastal region. Visit Galle Fort (UNESCO Site) with Dutch colonial architecture. Sunset walk along the fort ramparts.",
        locations: ["Galle"]
      },
      {
        day: 7,
        title: "Departure",
        description: "Morning beach relaxation. Transfer to Colombo airport for departure flight. Optional last-minute shopping for souvenirs.",
        locations: ["Colombo Airport"]
      }
    ];

    // Sample images for packages
    const packageImages = [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800", // Sri Lanka landscape
      "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800", // Sigiriya
      "https://images.unsplash.com/photo-1580392526015-e1c17e199284?w=800", // Temple
      "https://images.unsplash.com/photo-1633095160161-3e2b11b9b8eb?w=800", // Tea plantation
      "https://images.unsplash.com/photo-1578046908885-04a6b0a82ffc?w=800"  // Beach
    ];

    // Update first package with full details
    const updateQuery = `
      UPDATE tour_packages 
      SET 
        itinerary = $1,
        images = $2,
        full_description = $3,
        highlights = $4,
        includes = $5,
        excludes = $6
      WHERE name LIKE '%Cultural%' OR name LIKE '%Heritage%'
      RETURNING package_id, name
    `;

    const fullDescription = "This comprehensive 7-day tour takes you through the cultural triangle of Sri Lanka, visiting iconic sites like Sigiriya Rock Fortress, Temple of the Tooth in Kandy, ancient cave temples of Dambulla, and the colonial fort of Galle. You'll witness traditional dance performances, participate in cooking classes, and stay in heritage hotels that reflect the island's rich history. Experience the perfect blend of ancient culture, colonial heritage, and natural beauty.";

    const highlights = JSON.stringify([
      "Visit Sigiriya Rock Fortress - UNESCO World Heritage Site",
      "Explore the ancient city of Polonnaruwa",
      "Tour the Temple of the Tooth Relic in Kandy",
      "Witness traditional Kandyan dance performance",
      "Visit Dambulla Cave Temple with ancient Buddhist murals",
      "Explore Galle Fort - Dutch colonial architecture",
      "Experience a traditional Sri Lankan cooking class",
      "Tea plantation visit in hill country"
    ]);

    const includes = JSON.stringify([
      "Airport transfers and all transportation",
      "6 nights accommodation in 4-star hotels",
      "Daily breakfast and selected meals",
      "Professional English-speaking guide",
      "All entrance fees to monuments and sites",
      "Cultural show tickets",
      "Cooking class experience",
      "Bottled water during tours",
      "Government taxes and service charges"
    ]);

    const excludes = JSON.stringify([
      "International airfare",
      "Travel insurance",
      "Lunch and dinner (unless specified)",
      "Personal expenses and tips",
      "Alcoholic beverages",
      "Camera/video permits at sites",
      "Optional activities and excursions"
    ]);

    const result = await db.query(updateQuery, [
      JSON.stringify(culturalItinerary),
      packageImages,
      fullDescription,
      highlights,
      includes,
      excludes
    ]);

    if (result.rows.length > 0) {
      console.log('✅ Updated package:', result.rows[0].name);
      console.log('   Package ID:', result.rows[0].package_id);
      console.log('   Added', culturalItinerary.length, 'days itinerary');
      console.log('   Added', packageImages.length, 'images');
    } else {
      console.log('⚠️  No packages matched the criteria');
    }

    // Update a few more packages with basic details
    console.log('\n🔄 Adding basic details to other packages...\n');

    const beachImages = [
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800",
      "https://images.unsplash.com/photo-1606402179428-a57976c50fa1?w=800"
    ];

    const wildlifeImages = [
      "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=800",
      "https://images.unsplash.com/photo-1535338788174-0c6ea36f77f5?w=800",
      "https://images.unsplash.com/photo-1549366021-9f761d450615?w=800"
    ];

    // Update beach packages
    await db.query(`
      UPDATE tour_packages 
      SET images = $1
      WHERE category = 'Beach' AND images IS NULL
    `, [beachImages]);

    // Update wildlife packages
    await db.query(`
      UPDATE tour_packages 
      SET images = $1
      WHERE category = 'Wildlife' AND images IS NULL
    `, [wildlifeImages]);

    console.log('✅ Updated beach packages with images');
    console.log('✅ Updated wildlife packages with images');

    console.log('\n✅ Package update completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error updating packages:', error);
  } finally {
    process.exit(0);
  }
}

updatePackagesWithDetails();
