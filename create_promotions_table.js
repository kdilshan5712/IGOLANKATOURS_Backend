import db from "./src/config/db.js";

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        discount_code VARCHAR(50),
        image_url TEXT,
        display_style VARCHAR(50) DEFAULT 'banner' CHECK (display_style IN ('banner', 'marquee', 'popup')),
        is_active BOOLEAN DEFAULT true,
        start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("✅ Promotions table created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create table:", error);
    process.exit(1);
  }
};

createTable();
