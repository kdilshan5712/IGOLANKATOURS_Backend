import db from './src/config/db.js';
const inspect = async () => {
    try {
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chatbot_session' ORDER BY ordinal_position");
        console.log('--- chatbot_session ---');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
        
        const res2 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings' ORDER BY ordinal_position");
        console.log('--- bookings ---');
        res2.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
        const res3 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tour_packages' ORDER BY ordinal_position");
        console.log('--- tour_packages ---');
        res3.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (e) {
        console.error(e);
    }
  process.exit(0);
};
inspect();
