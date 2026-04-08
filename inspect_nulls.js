import db from './src/config/db.js';
const inspect = async () => {
    try {
        const res = await db.query(`
            SELECT column_name, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'tour_packages' 
            ORDER BY ordinal_position
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
  process.exit(0);
};
inspect();
