import db from './src/config/db.js';
import fs from 'fs';
const inspect = async () => {
    try {
        const res = await db.query(`
            SELECT column_name, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'tour_packages' 
            ORDER BY ordinal_position
        `);
        fs.writeFileSync('nulls_dump_fixed.txt', JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
  process.exit(0);
};
inspect();
