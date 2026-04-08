import db from './src/config/db.js';
const sessionId = '6a3fa855-c8ec-4d5f-95e9-d572a5e6df92';
const userId = '0dcd27dd-35a6-4446-9914-6fd20b3ba4b8'; 

const client = await db.pool.connect();
try {
    await client.query('BEGIN');
    const sessionRes = await client.query('SELECT * FROM chatbot_session WHERE session_id = $1', [sessionId]);
    const session = sessionRes.rows[0];
    
    // Attempt the problematic insert
    const q = `INSERT INTO bookings 
               (user_id, package_id, travel_date, travelers, total_price, deposit_amount, balance_amount, status, payment_status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
               RETURNING *`;
    const v = [
        userId,
        '07eba9a2-99b1-4524-b4bf-4b55b766378c', // Real package UUID
        new Date(),
        1,
        1000,
        1000,
        0,
        'confirmed',
        'pending'
    ];
    
    console.log('Attempting insert...');
    const res = await client.query(q, v);
    console.log('Success!', res.rows[0]);
    await client.query('ROLLBACK');
} catch (e) {
    console.error('FAILED:', e.message);
    console.error('DETAIL:', e.detail);
    console.error('HINT:', e.hint);
} finally {
    client.release();
    process.exit(0);
}
