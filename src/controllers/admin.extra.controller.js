import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";

/* ======================================================
   DASHBOARD STATISTICS
   ====================================================== */
export const getDashboardStats = async (req, res) => {
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
        (SELECT COUNT(*) FROM chatbot_session WHERE status = 'pending_approval') as pending_requests,
        (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts,
      (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())) as total_revenue
    `);

    // Fetch Revenue Trends (Last 6 Months)
    const revenueTrendsResult = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as name,
        SUM(total_price) as revenue
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '6 months'
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

/* ======================================================
   RECENT BOOKINGS
   ====================================================== */
export const getRecentBookings = async (req, res) => {
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

/* ======================================================
   PACKAGES MANAGEMENT
   ====================================================== */
export const getAllPackages = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.*,
        p.base_price as price,
        COUNT(DISTINCT b.booking_id) as booking_count,
        COUNT(DISTINCT r.review_id) as review_count,
        COALESCE(AVG(r.rating), 0) as avg_rating
      FROM tour_packages p
      LEFT JOIN bookings b ON p.package_id = b.package_id
      LEFT JOIN reviews r ON p.package_id = r.package_id
      GROUP BY p.package_id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      packages: result.rows
    });
  } catch (err) {
    console.error("getAllPackages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch packages"
    });
  }
};

export const createPackage = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      duration,
      category,
      budget,
      hotel,
      rating,
      image,
      season_type = 'year_round',
      coast_type = 'mixed'
    } = req.body;

    const result = await db.query(`
      INSERT INTO tour_packages (name, description, base_price, duration, category, budget, hotel, rating, image, season_type, coast_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *, base_price as price
    `, [name, description, price, duration, category, budget, hotel, rating || 0, image, season_type, coast_type]);

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      package: result.rows[0]
    });
  } catch (err) {
    console.error("createPackage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create package"
    });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const { packageId } = req.params;
    const updates = req.body;

    // Allowed fields for update
    const allowedFields = [
      'name', 'description', 'base_price', 'price',
      'duration', 'category', 'budget', 'hotel', 'rating', 'image',
      'season_type', 'coast_type', 'is_active', 'highlights',
      'includes', 'excludes', 'full_description', 'itinerary', 'images'
    ];

    // Filter out unwanted fields and map 'price' to 'base_price'
    const cleanUpdates = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'price') {
          cleanUpdates['base_price'] = updates[key];
        } else if (key === 'notIncluded') { // Handle frontend alias if sent
          cleanUpdates['excludes'] = updates[key];
        } else if (key === 'included') {
          cleanUpdates['includes'] = updates[key];
        } else if (key === 'fullDescription') {
          cleanUpdates['full_description'] = updates[key];
        } else {
          cleanUpdates[key] = updates[key];
        }
      }
    }

    if (Object.keys(cleanUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    // Dynamic SQL Generation
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(cleanUpdates)) {
      setClause.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    // Add updated_at
    setClause.push(`updated_at = NOW()`);

    const query = `
      UPDATE tour_packages
      SET ${setClause.join(', ')}
      WHERE package_id = $${paramIndex}
      RETURNING *, base_price as price
    `;
    values.push(packageId);

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    res.json({
      success: true,
      message: "Package updated successfully",
      package: result.rows[0]
    });
  } catch (err) {
    console.error("updatePackage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update package"
    });
  }
};

export const deletePackage = async (req, res) => {
  try {
    const { packageId } = req.params;

    const result = await db.query(`
      DELETE FROM tour_packages WHERE package_id = $1 RETURNING *
    `, [packageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    res.json({
      success: true,
      message: "Package deleted successfully"
    });
  } catch (err) {
    console.error("deletePackage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete package"
    });
  }
};

/* ======================================================
   BOOKINGS MANAGEMENT
   ====================================================== */
export const getAllBookings = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        b.*,
        p.name as package_name,
        p.duration,
        p.category,
        t.full_name as tourist_name,
        t.phone as tourist_phone,
        u.email as user_email,
        tg.full_name as guide_name,
        tg.contact_number as guide_phone,
        ug.email as guide_email
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_guide tg ON b.guide_id = tg.guide_id
      LEFT JOIN users ug ON tg.user_id = ug.user_id
      ORDER BY b.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      bookings: result.rows
    });
  } catch (err) {
    console.error("getAllBookings error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings"
    });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const result = await db.query(`
      UPDATE bookings
      SET status = $1
      WHERE booking_id = $2
      RETURNING *
    `, [status, bookingId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      message: "Booking status updated successfully",
      booking: result.rows[0]
    });
  } catch (err) {
    console.error("updateBookingStatus error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update booking status"
    });
  }
};

/* ======================================================
   REVIEWS MANAGEMENT
   ====================================================== */
export const getAllReviews = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.*,
        p.name as package_name,
        u.email as user_email
      FROM reviews r
      JOIN tour_packages p ON r.package_id = p.package_id
      JOIN users u ON r.user_id = u.user_id
      ORDER BY r.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      reviews: result.rows
    });
  } catch (err) {
    console.error("getAllReviews error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews"
    });
  }
};

export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const result = await db.query(`
      UPDATE reviews
      SET status = 'approved'
      WHERE review_id = $1
      RETURNING *
    `, [reviewId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    res.json({
      success: true,
      message: "Review approved successfully",
      review: result.rows[0]
    });
  } catch (err) {
    console.error("approveReview error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to approve review",
      details: err.message
    });
  }
};

export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const result = await db.query(`
      UPDATE reviews
      SET status = 'rejected'
      WHERE review_id = $1
      RETURNING *
    `, [reviewId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    res.json({
      success: true,
      message: "Review rejected successfully",
      review: result.rows[0]
    });
  } catch (err) {
    console.error("rejectReview error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to reject review",
      details: err.message
    });
  }
};

/* ======================================================
   USERS MANAGEMENT
   ====================================================== */
export const getAllUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.user_id,
        u.email,
        u.role,
        u.status,
        u.email_verified,
        u.created_at,
        CASE 
          WHEN u.role = 'tourist' THEN t.full_name
          WHEN u.role = 'guide' THEN tg.full_name
          ELSE NULL
        END as full_name,
        CASE 
          WHEN u.role = 'tourist' THEN t.phone
          WHEN u.role = 'guide' THEN tg.contact_number
          ELSE NULL
        END as contact,
        COALESCE(
          (SELECT COUNT(*) FROM bookings b 
           WHERE b.user_id = u.user_id), 
          0
        ) as booking_count
      FROM users u
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_guide tg ON u.user_id = tg.user_id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const result = await db.query(`
      UPDATE users
      SET status = $1
      WHERE user_id = $2
      RETURNING *
    `, [status, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User status updated successfully"
    });
  } catch (err) {
    console.error("updateUserStatus error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update user status"
    });
  }
};

/* ======================================================
   CONTACT MESSAGES
   ====================================================== */
export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const adminId = req.user?.user_id;

    const result = await db.query(`
      UPDATE contact_messages
      SET status = 'read', read_at = NOW(), read_by = $2
      WHERE message_id = $1
      RETURNING *
    `, [messageId, adminId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    res.json({
      success: true,
      message: "Message marked as read",
      contactMessage: result.rows[0]
    });
  } catch (err) {
    console.error("markMessageAsRead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark message as read"
    });
  }
};

/* ======================================================
   CUSTOM TOUR REQUESTS (CHATBOT SESSIONS)
   ====================================================== */
export const getCustomTourRequests = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        cs.*,
        COALESCE(cs.user_email, cm.email, u.email) as user_email,
        COALESCE(cs.tourist_name, cm.name, t.full_name) as tourist_name,
        COALESCE(cs.tourist_phone, cm.phone, t.phone) as tourist_phone,
        cm.status as contact_status,
        cm.message as contact_message
      FROM chatbot_session cs
      LEFT JOIN contact_messages cm ON cs.session_id = cm.session_id
      LEFT JOIN tourist t ON cs.tourist_id = t.tourist_id
      LEFT JOIN users u ON t.user_id = u.user_id
      ORDER BY cs.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      requests: result.rows
    });
  } catch (err) {
    console.error("getCustomTourRequests error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch custom tour requests"
    });
  }
};

export const updateCustomTourStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { 
      status, recommendations, admin_final_price, 
      approved_itinerary_json, rejection_reason, special_notes 
    } = req.body;
    const adminId = req.user?.user_id; // Added by authenticateAdmin

    let updateFields = [];
    let queryParams = [];
    let paramIndex = 1;

    if (status) { updateFields.push(`status = $${paramIndex++}`); queryParams.push(status); }
    if (recommendations !== undefined) { updateFields.push(`recommendations = $${paramIndex++}`); queryParams.push(typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations)); }
    if (admin_final_price !== undefined) { updateFields.push(`admin_final_price = $${paramIndex++}`); queryParams.push(admin_final_price); }
    if (approved_itinerary_json !== undefined) { updateFields.push(`approved_itinerary_json = $${paramIndex++}`); queryParams.push(typeof approved_itinerary_json === 'string' ? approved_itinerary_json : JSON.stringify(approved_itinerary_json)); }
    if (rejection_reason !== undefined) { updateFields.push(`rejection_reason = $${paramIndex++}`); queryParams.push(rejection_reason); }
    if (special_notes !== undefined) { updateFields.push(`special_notes = $${paramIndex++}`); queryParams.push(special_notes); }

    // Always update the approved_by timestamp if status is approved
    if (status === 'approved') {
        updateFields.push(`approved_at = NOW()`);
        if (adminId) {
            updateFields.push(`approved_by = $${paramIndex++}`);
            queryParams.push(adminId);
        }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    queryParams.push(requestId);

    const result = await db.query(`
      UPDATE chatbot_session
      SET ${updateFields.join(', ')}
      WHERE session_id = $${paramIndex}
      RETURNING *
    `, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    res.json({
      success: true,
      message: "Custom tour request updated successfully",
      request: result.rows[0]
    });
  } catch (err) {
    console.error("updateCustomTourStatus error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update custom tour request"
    });
  }
};

export const replyCustomTourRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message content is required" });
    }

    // Fetch the request details
    const result = await db.query(`
      SELECT 
        cs.*,
        u.email,
        t.full_name
      FROM chatbot_session cs
      JOIN tourist t ON cs.tourist_id = t.tourist_id
      JOIN users u ON t.user_id = u.user_id
      WHERE cs.session_id = $1
    `, [requestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const requestData = result.rows[0];

    // Send the email quote
    const emailTemplate = emailTemplates.customTourQuote(requestData.full_name, message);
    const emailSent = await sendEmail(requestData.email, emailTemplate.subject, emailTemplate.html);

    if (!emailSent) {
      return res.status(500).json({ success: false, message: "Failed to send email reply" });
    }

    // Update the database status to indicate it was quoted
    res.json({
      success: true,
      message: "Quote sent successfully"
    });

  } catch (err) {
    console.error("replyCustomTourRequest error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send custom tour reply"
    });
  }
};
