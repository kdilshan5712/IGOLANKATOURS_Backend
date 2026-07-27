import db from './src/config/db.js';

async function check() {
  const res = await db.query("SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'");
  console.log(res.rows);
  
  if (res.rows[0].data_type === 'USER-DEFINED') {
    const enumRes = await db.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = '" + res.rows[0].udt_name + "')");
    console.log(enumRes.rows);
  }
  process.exit(0);
}
check();
