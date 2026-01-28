
import db from '../config/db.js';

// GET /api/admin/dashboard
const getDashboardMetrics = async (req, res) => {
  try {
    const [packages, bookings, reviews, users, guides, pendingGuides, messages, customRequests, revenue] = await Promise.all([
      db.query('SELECT COUNT(*) FROM tour_package'),
      db.query('SELECT COUNT(*) FROM bookings'),
      db.query('SELECT COUNT(*) FROM review'),
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM tour_guide tg INNER JOIN users u ON tg.user_id = u.user_id WHERE tg.approved = true AND u.status = $1', ['active']),
      db.query("SELECT COUNT(*) FROM tour_guide tg INNER JOIN users u ON tg.user_id = u.user_id WHERE tg.approved = false"),
      db.query('SELECT COUNT(*) FROM contact_message WHERE status = $1', ['new']),
      db.query('SELECT COUNT(*) FROM custom_tour_request WHERE status = $1', ['new']),
      db.query('SELECT COALESCE(SUM(total_price),0) FROM bookings WHERE status = $1', ['completed'])
    ]);

    res.json({
      totalPackages: Number(packages.rows[0].count),
      totalBookings: Number(bookings.rows[0].count),
      totalReviews: Number(reviews.rows[0].count),
      totalUsers: Number(users.rows[0].count),
      totalGuides: Number(guides.rows[0].count),
      pendingGuides: Number(pendingGuides.rows[0].count),
      newMessages: Number(messages.rows[0].count),
      customRequests: Number(customRequests.rows[0].count),
      revenue: Number(revenue.rows[0].coalesce || revenue.rows[0].sum || 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard metrics', details: err.message });
  }
};

// GET /api/admin/dashboard/recent-bookings
const getRecentBookings = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        b.booking_id,
        b.booking_reference,
        b.travel_date,
        b.total_price,
        b.status,
        b.created_at,
        u.email as user_email,
        CONCAT(t.first_name, ' ', t.last_name) as tourist_name,
        tp.package_name,
        tg.full_name as guide_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_package tp ON b.package_id = tp.package_id
      LEFT JOIN tour_guide tg ON b.guide_id = tg.guide_id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (err) {
    console.error('Failed to fetch recent bookings:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch recent bookings', 
      details: err.message 
    });
  }
};

export default {
  getDashboardMetrics,
  getRecentBookings
};
