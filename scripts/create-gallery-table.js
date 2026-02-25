/**
 * GALLERY TABLE MIGRATION
 * Creates the gallery table for storing image metadata
 */

import db from '../src/config/db.js';

async function createGalleryTable() {
  try {
    console.log('🔧 Creating gallery table...\n');

    // Create gallery table
    await db.query(`
      CREATE TABLE IF NOT EXISTS gallery (
        gallery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        image_url text NOT NULL,
        title varchar(255) NOT NULL,
        description text,
        category varchar(100) NOT NULL,
        is_featured boolean DEFAULT false,
        display_order integer DEFAULT 0,
        status varchar(50) DEFAULT 'active',
        created_at timestamp with time zone DEFAULT NOW(),
        updated_at timestamp with time zone DEFAULT NOW()
      )
    `);

    console.log('✅ Gallery table created successfully');

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery(category)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_gallery_status ON gallery(status)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_gallery_is_featured ON gallery(is_featured)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_gallery_display_order ON gallery(display_order)
    `);

    console.log('✅ Indexes created successfully\n');

    console.log('🎉 Gallery migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  }
}

createGalleryTable();
