import db from '../src/config/db.js';

async function seedDashboardData() {
  try {
    console.log('🌱 Starting dashboard data seeding...\n');
    
    // Check if custom_tour_requests table exists
    console.log('1️⃣ Checking custom_tour_requests table...');
    try {
      await db.query('SELECT COUNT(*) FROM custom_tour_requests');
      console.log('✅ Table exists');
    } catch (err) {
      console.log('⚠️ Table does not exist, creating it...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS custom_tour_requests (
          request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(user_id),
          destination VARCHAR(255),
          num_people INTEGER,
          budget DECIMAL(10, 2),
          start_date DATE,
          end_date DATE,
          special_requests TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Table created');
    }
    
    // Check if contact_messages has status column
    console.log('\n2️⃣ Checking contact_messages status column...');
    try {
      const result = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'contact_messages' AND column_name = 'status'
      `);
      
      if (result.rows.length === 0) {
        console.log('⚠️ Adding status column to contact_messages...');
        await db.query(`
          ALTER TABLE contact_messages 
          ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'new'
        `);
        console.log('✅ Status column added');
      } else {
        console.log('✅ Status column exists');
      }
    } catch (err) {
      console.error('Error checking status column:', err.message);
    }
    
    // Add some sample reviews if none exist
    console.log('\n3️⃣ Checking reviews...');
    const reviewCount = await db.query('SELECT COUNT(*) FROM reviews');
    if (Number(reviewCount.rows[0].count) === 0) {
      console.log('⚠️ No reviews found, adding sample reviews...');
      
      // Get a user and package for sample reviews
      const users = await db.query('SELECT user_id FROM users WHERE role = $1 LIMIT 1', ['tourist']);
      const packages = await db.query('SELECT package_id FROM tour_packages LIMIT 3');
      
      if (users.rows.length > 0 && packages.rows.length > 0) {
        for (const pkg of packages.rows) {
          await db.query(`
            INSERT INTO reviews (user_id, package_id, rating, comment, status)
            VALUES ($1, $2, $3, $4, $5)
          `, [users.rows[0].user_id, pkg.package_id, Math.floor(4 + Math.random()), 'Great experience!', 'approved']);
        }
        console.log('✅ Added sample reviews');
      }
    } else {
      console.log(`✅ Found ${reviewCount.rows[0].count} reviews`);
    }
    
    // Update contact messages to have 'new' status
    console.log('\n4️⃣ Updating contact messages status...');
    try {
      const updateResult = await db.query(`
        UPDATE contact_messages 
        SET status = 'new' 
        WHERE status IS NULL OR status = ''
      `);
      console.log(`✅ Updated ${updateResult.rowCount} contact messages`);
    } catch (err) {
      console.log('⚠️ Could not update contact messages:', err.message);
    }
    
    // Verify final counts
    console.log('\n📊 FINAL DATABASE COUNTS:\n');
    
    const finalPackages = await db.query('SELECT COUNT(*) FROM tour_packages');
    console.log('📦 Tour Packages:', finalPackages.rows[0].count);
    
    const finalBookings = await db.query('SELECT COUNT(*) FROM bookings');
    console.log('📅 Bookings:', finalBookings.rows[0].count);
    
    const finalReviews = await db.query('SELECT COUNT(*) FROM reviews');
    console.log('⭐ Reviews:', finalReviews.rows[0].count);
    
    const finalUsers = await db.query('SELECT COUNT(*) FROM users');
    console.log('👥 Users:', finalUsers.rows[0].count);
    
    const finalGuides = await db.query('SELECT COUNT(*) FROM tour_guide WHERE approved = true');
    console.log('🧭 Approved Guides:', finalGuides.rows[0].count);
    
    const finalPendingGuides = await db.query('SELECT COUNT(*) FROM tour_guide WHERE approved = false');
    console.log('⏳ Pending Guides:', finalPendingGuides.rows[0].count);
    
    const finalMessages = await db.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'new'");
    console.log('✉️ New Messages:', finalMessages.rows[0].count);
    
    const finalRequests = await db.query("SELECT COUNT(*) FROM custom_tour_requests WHERE status = 'pending'");
    console.log('🎯 Pending Requests:', finalRequests.rows[0].count);
    
    const totalRevenue = await db.query("SELECT COALESCE(SUM(total_price),0) as total FROM bookings WHERE status = 'completed'");
    console.log('💰 Total Revenue:', totalRevenue.rows[0].total);
    
    const avgRating = await db.query('SELECT COALESCE(AVG(rating),0) as avg FROM reviews');
    console.log('⭐ Average Rating:', Number(avgRating.rows[0].avg).toFixed(1));
    
    console.log('\n✅ Dashboard data seeding complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error seeding dashboard data:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

seedDashboardData();
