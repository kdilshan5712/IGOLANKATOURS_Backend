import db from './src/config/db.js';
import fs from 'fs';
const inspect = async () => {
    try {
        let output = '';
        const tables = ['chatbot_session', 'bookings', 'tour_packages'];
        for (const table of tables) {
            const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [table]);
            output += `\n--- ${table} ---\n`;
            res.rows.forEach(r => output += `${r.column_name}: ${r.data_type}\n`);
        }
        fs.writeFileSync('schema_dump.txt', output);
        console.log('Schema dumped to schema_dump.txt');
    } catch (e) {
        console.error(e);
    }
  process.exit(0);
};
inspect();
