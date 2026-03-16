import pool from '../src/config/db.js';

const createWishlistTable = async () => {
    try {
        console.log('Creating wishlists table...');

        const query = `
      CREATE TABLE IF NOT EXISTS wishlists (
        wishlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        package_id UUID NOT NULL REFERENCES tour_packages(package_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, package_id)
      );
    `;

        await pool.query(query);
        console.log('✅ wishlists table created successfully');

    } catch (error) {
        console.error('❌ Error creating wishlists table:', error);
    } finally {
        process.exit();
    }
};

createWishlistTable();
