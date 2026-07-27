import db from './src/config/db.js';

async function makeSuperAdmin() {
  try {
    const res = await db.query("UPDATE users SET role = 'superadmin' WHERE role = 'admin' RETURNING email, role");
    if (res.rows.length > 0) {
      console.log("Successfully updated the following admins to superadmin:");
      console.log(res.rows);
    } else {
      console.log("No admins found to update.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}
makeSuperAdmin();
