
import db from '../config/db.js';

// GET /api/admin/dashboard
const getDashboardMetrics = async (req, res) => {
  try {
    console.log('📊 [DASHBOARD] Fetching dashboard metrics...');

    const [packages, bookings, reviews, users, guides, pendingGuides, messages, customRequests, revenue, avgRating] = await Promise.all([
      db.query('SELECT COUNT(*) FROM tour_packages'),
      db.query('SELECT COUNT(*) FROM bookings'),
      db.query('SELECT COUNT(*) FROM reviews'),
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM tour_guide tg INNER JOIN users u ON tg.user_id = u.user_id WHERE tg.approved = true AND u.status = $1', ['active']),
      db.query("SELECT COUNT(*) FROM tour_guide tg INNER JOIN users u ON tg.user_id = u.user_id WHERE tg.approved = false"),
      db.query('SELECT COUNT(*) FROM contact_messages WHERE status = $1', ['new']),
      db.query('SELECT COUNT(*) FROM custom_tour_requests WHERE status = $1', ['pending']),
      db.query('SELECT COALESCE(SUM(total_price),0) FROM bookings WHERE status IN ($1, $2)', ['confirmed', 'completed']),
      db.query('SELECT COALESCE(AVG(rating),0) FROM reviews')
    ]);

    const stats = {
      total_packages: Number(packages.rows[0].count),
      total_bookings: Number(bookings.rows[0].count),
      total_reviews: Number(reviews.rows[0].count),
      total_users: Number(users.rows[0].count),
      total_guides: Number(guides.rows[0].count),
      pending_guide_approvals: Number(pendingGuides.rows[0].count),
      new_messages: Number(messages.rows[0].count),
      pending_requests: Number(customRequests.rows[0].count),
      total_revenue: Number(revenue.rows[0].coalesce || revenue.rows[0].sum || 0),
      average_rating: Number(avgRating.rows[0].coalesce || avgRating.rows[0].avg || 0).toFixed(1)
    };

    console.log('✅ [DASHBOARD] Stats calculated:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('❌ [DASHBOARD] Failed to fetch dashboard metrics:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard metrics',
      details: err.message
    });
  }
};

// GET /api/admin/dashboard/recent-bookings
const getRecentBookings = async (req, res) => {
  try {
    console.log('📅 [DASHBOARD] Fetching recent bookings...');

    const result = await db.query(`
      SELECT 
        b.booking_id,
        b.booking_reference,
        b.travel_date,
        b.total_price,
        b.status,
        b.created_at,
        b.assigned_guide_id,
        u.email as user_email,
        t.full_name as tourist_name,
        tp.name as package_name,
        tp.package_id,
        b.user_id,
        b.num_people,
        b.special_requests
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    console.log(`✅ [DASHBOARD] Found ${result.rows.length} recent bookings`);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (err) {
    console.error('❌ [DASHBOARD] Failed to fetch recent bookings:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent bookings',
      details: err.message
    });
  }
};

// GET /api/admin/dashboard/revenue-report
const getRevenueReport = async (req, res) => {
  try {
    console.log('💰 [REVENUE] Fetching revenue report...');

    const { dateFrom, dateTo } = req.query;

    // Build WHERE clause for date range
    let dateFilter = '';
    const params = [];
    if (dateFrom && dateTo) {
      dateFilter = 'WHERE b.created_at >= $1 AND b.created_at <= $2';
      params.push(dateFrom, dateTo);
    }

    // Query 1: Total revenue summary
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_price ELSE 0 END), 0) as completed_revenue,
        COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.total_price ELSE 0 END), 0) as confirmed_revenue,
        COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN b.total_price ELSE 0 END), 0) as cancelled_revenue,
        COALESCE(SUM(b.total_price), 0) as total_revenue,
        COUNT(*) as total_bookings,
        COALESCE(AVG(b.total_price), 0) as avg_booking_value
      FROM bookings b
      ${dateFilter}
    `;

    // Query 2: Revenue by package
    const packageRevenueQuery = `
      SELECT 
        tp.name as package_name,
        COUNT(b.booking_id) as bookings_count,
        COALESCE(SUM(b.total_price), 0) as package_revenue,
        COALESCE(AVG(b.total_price), 0) as avg_price
      FROM bookings b
      LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
      ${dateFilter}
      GROUP BY tp.package_id, tp.name
      ORDER BY package_revenue DESC
    `;

    // Query 3: Revenue by status
    const statusRevenueQuery = `
      SELECT 
        b.status,
        COUNT(b.booking_id) as bookings_count,
        COALESCE(SUM(b.total_price), 0) as status_revenue
      FROM bookings b
      ${dateFilter}
      GROUP BY b.status
      ORDER BY status_revenue DESC
    `;

    // Query 4: Monthly revenue trend
    const monthlyRevenueQuery = `
      SELECT 
        DATE_TRUNC('month', b.created_at) as month,
        COALESCE(SUM(b.total_price), 0) as monthly_revenue,
        COUNT(b.booking_id) as bookings_count
      FROM bookings b
      ${dateFilter}
      GROUP BY DATE_TRUNC('month', b.created_at)
      ORDER BY month DESC
    `;

    // Execute all queries in parallel
    const [summary, packageRevenue, statusRevenue, monthlyRevenue] = await Promise.all([
      db.query(summaryQuery, params),
      db.query(packageRevenueQuery, params),
      db.query(statusRevenueQuery, params),
      db.query(monthlyRevenueQuery, params)
    ]);

    const reportData = {
      summary: {
        total_revenue: Number(summary.rows[0].total_revenue || 0),
        completed_revenue: Number(summary.rows[0].completed_revenue || 0),
        confirmed_revenue: Number(summary.rows[0].confirmed_revenue || 0),
        cancelled_revenue: Number(summary.rows[0].cancelled_revenue || 0),
        total_bookings: Number(summary.rows[0].total_bookings || 0),
        average_booking_value: Number(summary.rows[0].avg_booking_value || 0).toFixed(2)
      },
      by_package: packageRevenue.rows.map(row => ({
        package_name: row.package_name || 'Unknown',
        bookings_count: Number(row.bookings_count || 0),
        revenue: Number(row.package_revenue || 0),
        average_price: Number(row.avg_price || 0).toFixed(2)
      })),
      by_status: statusRevenue.rows.map(row => ({
        status: row.status,
        bookings_count: Number(row.bookings_count || 0),
        revenue: Number(row.status_revenue || 0)
      })),
      monthly_trend: monthlyRevenue.rows.map(row => ({
        month: row.month ? new Date(row.month).toISOString().split('T')[0] : null,
        revenue: Number(row.monthly_revenue || 0),
        bookings_count: Number(row.bookings_count || 0)
      }))
    };

    console.log('✅ [REVENUE] Report generated:', reportData.summary);

    res.json({
      success: true,
      report: reportData
    });
  } catch (err) {
    console.error('❌ [REVENUE] Failed to fetch revenue report:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue report',
      details: err.message
    });
  }
};

// GET /api/admin/dashboard/generate-report
const generateReport = async (req, res) => {
  try {
    const { type, format, dateFrom, dateTo } = req.query;
    console.log(`📊 [REPORT] Generating ${type} report in ${format} format...`);

    // Dynamic import for report generator
    const {
      generateBookingReportPDF,
      generateBookingReportCSV,
      generateUserReportCSV
    } = await import('../utils/reportGenerator.js');

    // Build date filter
    let dateFilter = '';
    const params = [];
    if (dateFrom && dateTo) {
      dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
      params.push(dateFrom, dateTo);
    }

    if (type === 'booking') {
      const query = `
        SELECT b.*, u.email as user_email, t.full_name as tourist_name, tp.name as package_name
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN tourist t ON u.user_id = t.user_id
        LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
        ${dateFilter.replace('created_at', 'b.created_at')}
        ORDER BY b.created_at DESC
      `;
      const result = await db.query(query, params);

      if (format === 'pdf') {
        await generateBookingReportPDF(result.rows, res);
      } else {
        await generateBookingReportCSV(result.rows, res);
      }
    } else if (type === 'user') {
      const query = `
        SELECT u.*, COALESCE(t.full_name, tg.full_name) as full_name
        FROM users u
        LEFT JOIN tourist t ON u.user_id = t.user_id
        LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
        ${dateFilter.replace('created_at', 'u.created_at')}
        ORDER BY u.created_at DESC
      `;
      const result = await db.query(query, params);

      // User report only supports CSV for now
      await generateUserReportCSV(result.rows, res);
    } else {
      res.status(400).json({ success: false, message: 'Invalid report type' });
    }

  } catch (err) {
    console.error('❌ [REPORT] Failed to generate report:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      details: err.message
    });
  }
};

export default {
  getDashboardMetrics,
  getRecentBookings,
  getRevenueReport,
  generateReport
};
