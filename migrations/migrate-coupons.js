import db from "../src/config/db.js";

const migrate = async () => {
    try {
        console.log("🚀 Starting Coupon System Migration...");

        // 1. Create coupons table
        console.log("Creating 'coupons' table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                coupon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(50) UNIQUE NOT NULL,
                discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
                discount_value NUMERIC NOT NULL,
                min_amount NUMERIC DEFAULT 0,
                max_discount NUMERIC,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expiry_date TIMESTAMP,
                usage_limit INTEGER,
                usage_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Modify bookings table
        console.log("Modifying 'bookings' table...");
        
        // Check if columns already exist to avoid errors
        const columnCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name IN ('coupon_id', 'discount_amount');
        `);
        
        const existingColumns = columnCheck.rows.map(r => r.column_name);
        
        if (!existingColumns.includes('coupon_id')) {
            await db.query(`ALTER TABLE bookings ADD COLUMN coupon_id UUID REFERENCES coupons(coupon_id);`);
        }
        
        if (!existingColumns.includes('discount_amount')) {
            await db.query(`ALTER TABLE bookings ADD COLUMN discount_amount NUMERIC DEFAULT 0;`);
        }

        console.log("✅ Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error.message);
        process.exit(1);
    }
};

migrate();
