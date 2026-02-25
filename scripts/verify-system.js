import db from '../src/config/db.js';
const { pool } = db;
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

console.log('\n🚀 Starting System Verification...\n');

const checkEnv = () => {
    console.log('1. 🔐 Environment Variables Check:');
    const required = ['PORT', 'JWT_SECRET', 'STRIPE_SECRET_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const dbKeys = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'];

    // Check if DATABASE_URL or individual DB keys exist
    if (!process.env.DATABASE_URL) {
        required.push(...dbKeys);
    }

    let missing = [];

    required.forEach(key => {
        if (!process.env[key]) {
            missing.push(key);
        } else {
            // Mask logic
            const val = process.env[key];
            const masked = val.length > 8 ? val.substring(0, 4) + '****' + val.substring(val.length - 4) : '****';
            console.log(`   ✅ ${key} is set (${masked})`);
        }
    });

    if (missing.length > 0) {
        console.error(`   ❌ Missing keys: ${missing.join(', ')}`);
        return false;
    }
    return true;
};

const checkDB = async () => {
    console.log('\n2. 🐘 Database Connection & Schema Check:');
    try {
        const client = await pool.connect();
        console.log('   ✅ Connected to Database');

        const tables = ['users', 'bookings', 'packages', 'guides', 'payments', 'email_logs'];

        for (const table of tables) {
            const res = await client.query(`SELECT to_regclass('public.${table}');`);
            if (res.rows[0].to_regclass) {
                console.log(`   ✅ Table '${table}' exists`);
            } else {
                console.error(`   ❌ Table '${table}' MISSING`);
            }
        }

        client.release();
    } catch (err) {
        console.error('   ❌ Database connection failed:', err.message);
    }
};

const checkStripe = async () => {
    console.log('\n3. 💳 Stripe Configuration Check:');
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        // Simple light call - list 1 customer or just check balance
        const balance = await stripe.balance.retrieve();
        console.log('   ✅ Stripe Connection Successful');
        console.log(`   💰 Available Balance: ${balance.available[0].amount} ${balance.available[0].currency}`);
    } catch (err) {
        console.error('   ❌ Stripe Connection Failed:', err.message);
    }
};

const run = async () => {
    checkEnv();
    await checkDB();
    await checkStripe();
    console.log('\n✨ Verification Complete!\n');
    process.exit(0);
};

run();
