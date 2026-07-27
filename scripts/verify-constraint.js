import db from '../src/config/db.js';

const res = await db.query(`
  SELECT c.conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'bookings' AND c.conname LIKE '%status%'
`);
console.log('Current bookings status constraints:');
res.rows.forEach(r => console.log(` [${r.conname}]`, r.def));
process.exit(0);
