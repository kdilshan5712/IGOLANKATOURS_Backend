
import db from './src/config/db.js';

async function check() {
  try {
    const sessionId = '6a3fa855-c8ec-4d5f-95e9-d572a5e6df92';
    const res = await db.query('SELECT * FROM chatbot_session WHERE session_id = $1', [sessionId]);
    console.log('SESSION:', JSON.stringify(res.rows, null, 2));
    
    if (res.rows.length > 0) {
        const touristId = res.rows[0].tourist_id;
        console.log('TOURIST ID IN SESSION:', touristId);
        const touristRes = await db.query('SELECT * FROM tourist WHERE tourist_id = $1', [touristId]);
        console.log('TOURIST PROFILE:', JSON.stringify(touristRes.rows, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
