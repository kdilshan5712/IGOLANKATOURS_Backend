import db from "../src/config/db.js";

const migrate = async () => {
    try {
        console.log("🚀 Starting Booking Travellers Table Migration...");

        // Create booking_travellers table
        console.log("Creating 'booking_travellers' table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS booking_travellers (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER REFERENCES bookings(booking_id) ON DELETE CASCADE,
                full_name VARCHAR(255) NOT NULL,
                passport_number VARCHAR(50) NOT NULL,
                passport_expiry DATE NOT NULL,
                nationality VARCHAR(100) NOT NULL,
                date_of_birth DATE NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('Adult', 'Child')),
                is_primary BOOLEAN DEFAULT FALSE,
                dietary_restrictions TEXT,
                medical_conditions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error.message);
        process.exit(1);
    }
};

migrate();
