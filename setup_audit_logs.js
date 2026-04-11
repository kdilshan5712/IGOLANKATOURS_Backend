import db from "./src/config/db.js";

const setup = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                admin_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
                action_type VARCHAR(100) NOT NULL,
                target_type VARCHAR(100) NOT NULL,
                target_id VARCHAR(255),
                changes JSONB,
                description TEXT,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        const res = await db.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')");
        console.log('✅ audit_logs table setup complete. Exists:', res.rows[0].exists);
    } catch (err) {
        console.error('❌ Error in audit_logs setup:', err);
    } finally {
        process.exit();
    }
};

setup();
