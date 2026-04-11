import db from './src/config/db.js';

const checkPackages = async () => {
  try {
    const res = await db.query('SELECT package_id, name, base_price as price, category FROM tour_packages LIMIT 5');
    console.log('--- Tour Packages in DB ---');
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

checkPackages();
