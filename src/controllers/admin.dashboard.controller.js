
import db from '../config/db.js';
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";

/**
 * Retrieves comprehensive dashboard statistics, including user counts, booking status distribution,
 * revenue trends (last 6 months), and top-performing packages.
 * 
 * @async
 * @function getDashboardStats
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the aggregated statistics.
 */
const getDashboardStats = async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'tourist') as total_tourists,
        (SELECT COUNT(*) FROM tour_guide) as total_guides,
        (SELECT COUNT(*) FROM tour_guide WHERE approved = true) as approved_guides,
        (SELECT COUNT(*) FROM tour_guide WHERE approved = false AND EXISTS (
          SELECT 1 FROM users u WHERE u.user_id = tour_guide.user_id AND u.status = 'pending'
        )) as pending_guide_approvals,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM reviews) as total_reviews,
        (SELECT COUNT(*) FROM reviews WHERE status = 'pending') as pending_reviews,
        (SELECT COUNT(*) FROM tour_packages) as total_packages,
        (SELECT COUNT(*) FROM contact_messages WHERE status = 'new') as new_messages,
        (SELECT COUNT(*) FROM chatbot_session WHERE status = 'pending') as pending_requests,
        (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('confirmed', 'completed') AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) as total_revenue
    `);

    // Fetch Revenue Trends (Last 6 Months)
    const revenueTrendsResult = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as name,
        SUM(total_price) as revenue
      FROM bookings
      WHERE status IN ('confirmed', 'completed') AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // Fetch Booking Status Distribution
    const bookingStatusResult = await db.query(`
      SELECT 
        status as name,
        COUNT(*) as value
      FROM bookings
      GROUP BY status
    `);

    // Fetch Top Packages
    const topPackagesResult = await db.query(`
      SELECT 
        p.name,
        COUNT(b.booking_id) as bookings
      FROM tour_packages p
      LEFT JOIN bookings b ON p.package_id = b.package_id
      GROUP BY p.package_id, p.name
      ORDER BY bookings DESC
      LIMIT 5
    `);

    const stats = statsResult.rows[0];
    stats.revenueTrends = revenueTrendsResult.rows.map(row => ({ name: row.name, revenue: parseFloat(row.revenue) || 0 }));
    stats.bookingDistribution = bookingStatusResult.rows.map(row => ({ name: row.name, value: parseInt(row.value) || 0 }));
    stats.topPackages = topPackagesResult.rows.map(row => ({
      name: (row.name.length > 15) ? row.name.substring(0, 15) + '...' : row.name,
      bookings: parseInt(row.bookings) || 0
    }));

    res.json({
      success: true,
      stats: stats
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats"
    });
  }
};

/**
 * Retrieves counts of items requiring urgent attention, such as unread messages,
 * pending payout requests, guide applications, and reviews.
 * 
 * @async
 * @function getNotificationCounts
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with notification counts.
 */
const getNotificationCounts = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM contact_messages WHERE status = 'new') as unread_messages,
        (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts,
        (SELECT COUNT(*) FROM tour_guide tg INNER JOIN users u ON tg.user_id = u.user_id WHERE tg.approved = false AND u.status = 'pending') as pending_guides,
        (SELECT COUNT(*) FROM chatbot_session WHERE status = 'pending' OR status = 'pending_approval') as pending_custom_tours,
        (SELECT COUNT(*) FROM reviews WHERE status = 'pending') as pending_reviews
    `);

    res.json({
      success: true,
      counts: result.rows[0]
    });
  } catch (err) {
    console.error("getNotificationCounts error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification counts"
    });
  }
};

/**
 * Fetches a list of the most recent bookings with package and tourist details.
 * 
 * @async
 * @function getRecentBookings
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {number} [req.query.limit=10] - Maximum number of bookings to return.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the recent bookings.
 */
const getRecentBookings = async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    const result = await db.query(`
      SELECT 
        b.booking_id,
        b.travel_date,
        b.total_price,
        b.status,
        b.created_at,
        p.name as package_name,
        u.email as user_email,
        t.full_name as tourist_name
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      ORDER BY b.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (err) {
    console.error("getRecentBookings error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent bookings"
    });
  }
};

/**
 * Internal helper to aggregate revenue data across different dimensions (summary, by package, by status, monthly trend).
 * 
 * @async
 * @function fetchRevenueReportData
 * @param {string} [dateFrom] - Start date for filtering.
 * @param {string} [dateTo] - End date for filtering.
 * @returns {Promise<Object>} An object containing summarized revenue statistics.
 */
const fetchRevenueReportData = async (dateFrom, dateTo) => {
  let dateFilter = '';
  const params = [];
  if (dateFrom && dateTo) {
    dateFilter = 'WHERE b.created_at >= $1 AND b.created_at <= $2';
    params.push(dateFrom, dateTo);
  }

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

  const [summary, packageRevenue, statusRevenue, monthlyRevenue] = await Promise.all([
    db.query(summaryQuery, params),
    db.query(packageRevenueQuery, params),
    db.query(statusRevenueQuery, params),
    db.query(monthlyRevenueQuery, params)
  ]);

  return {
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
};

/**
 * Fetches a summarized revenue report, optionally filtered by date range.
 * 
 * @async
 * @function getRevenueReport
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.dateFrom] - Optional start date filter.
 * @param {string} [req.query.dateTo] - Optional end date filter.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the revenue report.
 */
const getRevenueReport = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const reportData = await fetchRevenueReportData(dateFrom, dateTo);
    res.json({ success: true, report: reportData });
  } catch (err) {
    console.error('getRevenueReport error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch revenue report' });
  }
};

/**
 * Generates and streams a downloadable report (PDF or CSV) based on the specified type
 * (booking, user, revenue, or audit).
 * 
 * @async
 * @function generateReport
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} req.query.type - Report type ('booking', 'user', 'revenue', 'audit').
 * @param {string} req.query.format - Output format ('pdf' or 'csv').
 * @param {string} [req.query.dateFrom] - Optional start date filter.
 * @param {string} [req.query.dateTo] - Optional end date filter.
 * @param {Object} res - Express response object (used for streaming the file).
 * @returns {Promise<void>} Streams the report file to the client.
 */
const generateReport = async (req, res) => {
  try {
    const { type, format, dateFrom, dateTo } = req.query;
    const {
      generateBookingReportPDF,
      generateBookingReportCSV,
      generateUserReportCSV,
      generateRevenueReportPDF,
      generateRevenueReportCSV,
      generateAuditLogReportPDF,
      generateAuditLogReportCSV
    } = await import('../utils/reportGenerator.js');

    let dateFilter = '';
    const params = [];
    if (dateFrom && dateTo) {
      dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
      params.push(dateFrom, dateTo);
    }

    if (type === 'booking') {
      const bookingQuery = `
        SELECT b.*, u.email as user_email, t.full_name as tourist_name, tp.name as package_name
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN tourist t ON u.user_id = t.user_id
        LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
        ${dateFilter.replace(/created_at/g, 'b.created_at')}
        ORDER BY b.created_at DESC
      `;
      const bookingResult = await db.query(bookingQuery, params);
      if (format === 'pdf') await generateBookingReportPDF(bookingResult.rows, res);
      else await generateBookingReportCSV(bookingResult.rows, res);
    } else if (type === 'user') {
      const userQuery = `
        SELECT u.*, COALESCE(t.full_name, tg.full_name) as full_name
        FROM users u
        LEFT JOIN tourist t ON u.user_id = t.user_id
        LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
        ${dateFilter.replace(/created_at/g, 'u.created_at')}
        ORDER BY u.created_at DESC
      `;
      const userResult = await db.query(userQuery, params);
      await generateUserReportCSV(userResult.rows, res);
    } else if (type === 'revenue') {
      const reportData = await fetchRevenueReportData(dateFrom, dateTo);
      if (format === 'pdf') await generateRevenueReportPDF(reportData, res);
      else await generateRevenueReportCSV(reportData, res);
    } else if (type === 'audit') {
      let auditQuery = `
        SELECT 
          l.*,
          u.email as admin_email,
          CASE 
            WHEN u.role = 'admin' THEN 'System Administrator'
            ELSE 'Staff'
          END as admin_name
        FROM audit_logs l
        LEFT JOIN users u ON l.admin_id = u.user_id
        ${dateFilter.replace(/created_at/g, 'l.created_at')}
        ORDER BY l.created_at DESC
      `;
      const auditResult = await db.query(auditQuery, params);
      if (format === 'pdf') await generateAuditLogReportPDF(auditResult.rows, res);
      else await generateAuditLogReportCSV(auditResult.rows, res);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid report type' });
    }
  } catch (err) {
    console.error('generateReport error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
  }
};

export default {
  getDashboardStats,
  getNotificationCounts,
  getRecentBookings,
  getRevenueReport,
  generateReport
};

