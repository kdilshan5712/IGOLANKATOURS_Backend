import fs from 'fs';
import db from './src/config/db.js';
const res = await db.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bookings_status_check'");
if (res.rows.length > 0) {
    fs.writeFileSync('status_constraint.txt', res.rows[0].pg_get_constraintdef);
}
process.exit(0);
