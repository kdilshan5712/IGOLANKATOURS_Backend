import db from "../src/config/db.js";

const addDummyData = async () => {
  try {
    console.log('🌱 Adding dummy data...\n');

    // Get a tourist user and package to reference
    let tourist = await db.query(`
      SELECT t.tourist_id, t.user_id 
      FROM tourist t
      JOIN users u ON t.user_id = u.user_id
      WHERE u.role = 'tourist'
      LIMIT 1
    `);

    const tourPackage = await db.query(`
      SELECT package_id, name, price 
      FROM tour_packages 
      LIMIT 1
    `);

    if (tourist.rows.length === 0) {
      console.log('❌ No tourist found. Creating one...');
      
      // Create a test user with unique email
      const timestamp = Date.now();
      const userResult = await db.query(`
        INSERT INTO users (email, password_hash, role, status, email_verified)
        VALUES ($1, '$2b$10$abcdefghijklmnopqrstuv', 'tourist', 'active', true)
        RETURNING user_id
      `, [`tourist${timestamp}@test.com`]);
      
      const touristResult = await db.query(`
        INSERT INTO tourist (user_id, full_name, phone, country)
        VALUES ($1, 'John Doe', '+94771234567', 'Sri Lanka')
        RETURNING tourist_id, user_id
      `, [userResult.rows[0].user_id]);
      
      tourist = touristResult;
      console.log('✅ Created test tourist');
    }

    const touristId = tourist.rows[0].tourist_id;
    const userId = tourist.rows[0].user_id;
    const packageId = tourPackage.rows[0].package_id;
    const packagePrice = parseFloat(tourPackage.rows[0].price);

    // Insert a confirmed booking
    console.log('📅 Adding confirmed booking...');
    const bookingResult = await db.query(`
      INSERT INTO booking (
        tourist_id,
        package_id,
        travel_date,
        total_cost,
        booking_date,
        status
      )
      VALUES (
        $1,
        $2,
        CURRENT_DATE + INTERVAL '30 days',
        $3,
        CURRENT_DATE,
        'confirmed'
      )
      RETURNING booking_id, travel_date, total_cost
    `, [touristId, packageId, packagePrice * 2]);

    console.log(`✅ Booking created: ID ${bookingResult.rows[0].booking_id}, Total: $${bookingResult.rows[0].total_cost}`);

    // Insert multiple reviews for different packages
    console.log('\n⭐ Adding dummy reviews...');
    
    const packages = await db.query(`
      SELECT package_id, name 
      FROM tour_packages 
      LIMIT 5
    `);

    const reviews = [
      {
        rating: 5,
        message: "Amazing experience! The tour was well organized and our guide was very knowledgeable. Highly recommend!",
        status: 'approved'
      },
      {
        rating: 4,
        message: "Great tour overall. Beautiful locations and friendly staff. Only minor issue was the schedule was a bit rushed.",
        status: 'approved'
      },
      {
        rating: 5,
        message: "Best vacation ever! Everything was perfect from start to finish. Will definitely book again!",
        status: 'approved'
      },
      {
        rating: 4,
        message: "Very enjoyable tour. Good value for money. The accommodation was comfortable and food was delicious.",
        status: 'pending'
      },
      {
        rating: 5,
        message: "Exceeded all expectations! The wildlife safari was breathtaking. Professional team and excellent service.",
        status: 'approved'
      }
    ];

    for (let i = 0; i < Math.min(reviews.length, packages.rows.length); i++) {
      const review = reviews[i];
      const pkg = packages.rows[i];
      
      await db.query(`
        INSERT INTO reviews (
          user_id,
          package_id,
          rating,
          message,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - INTERVAL '${i} days')
      `, [userId, pkg.package_id, review.rating, review.message, review.status]);

      console.log(`✅ Review ${i + 1}: ${review.rating} stars for "${pkg.name}" (${review.status})`);
    }

    console.log('\n🎉 Dummy data added successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - 1 confirmed booking created`);
    console.log(`   - ${reviews.length} reviews added`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

addDummyData();
