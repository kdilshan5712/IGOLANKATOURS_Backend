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
        (SELECT COUNT(*) FROM chatbot_session) as pending_requests,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())) as total_revenue
    `);

    res.json({
      success: true,
      stats: statsResult.rows[0]
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
      image
    } = req.body;

    const result = await db.query(`
      INSERT INTO tour_packages (name, description, price, duration, category, budget, hotel, rating, image)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, description, price, duration, category, budget, hotel, rating || 0, image]);

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
    const {
      name,
      description,
      price,
      duration,
      category,
      budget,
      hotel,
      rating,
      image
    } = req.body;

    const result = await db.query(`
      UPDATE tour_packages
      SET name = $1, description = $2, price = $3, duration = $4, category = $5,
          budget = $6, hotel = $7, rating = $8, image = $9, updated_at = NOW()
      WHERE package_id = $10
      RETURNING *
    `, [name, description, price, duration, category, budget, hotel, rating || 0, image, packageId]);

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
    const adminId = req.user?.user_id;

    const result = await db.query(`
      UPDATE reviews
      SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE review_id = $1
      RETURNING *
    `, [reviewId, adminId]);

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
    console.error("approveReview error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to approve review" 
    });
  }
};

export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const adminId = req.user?.user_id;

    const result = await db.query(`
      UPDATE reviews
      SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE review_id = $1
      RETURNING *
    `, [reviewId, adminId]);

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
    console.error("rejectReview error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to reject review" 
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
        cs.session_id,
        cs.tourist_id,
        cs.preferences,
        cs.recommendations,
        cs.created_at,
        u.email as user_email,
        t.full_name as tourist_name,
        t.phone as tourist_phone
      FROM chatbot_session cs
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
    const { recommendations } = req.body;

    const result = await db.query(`
      UPDATE chatbot_session
      SET recommendations = $1
      WHERE session_id = $2
      RETURNING *
    `, [recommendations, requestId]);

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

/* ======================================================
   GUIDE ASSIGNMENT TO BOOKINGS
   ====================================================== */

/**
 * GET AVAILABLE GUIDES
 * Returns only approved and active guides for assignment
 */
export const getAvailableGuides = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        tg.guide_id,
        tg.full_name,
        tg.contact_number,
        u.email,
        tg.languages,
        tg.experience_years
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      WHERE u.role = 'guide'
        AND u.status = 'active'
        AND tg.approved = true
      ORDER BY tg.full_name ASC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      guides: result.rows
    });
  } catch (err) {
    console.error("getAvailableGuides error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch available guides" 
    });
  }
};

/**
 * ASSIGN GUIDE TO BOOKING
 * Admin assigns a guide to a specific booking
 */
export const assignGuideToBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { guideId, adminNotes } = req.body;
    const adminUserId = req.user.user_id; // From auth middleware

    // Validate inputs
    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Guide ID is required"
      });
    }

    // Verify booking exists and is eligible for assignment
    const bookingCheck = await db.query(
      `SELECT booking_id, status, assigned_guide_id FROM bookings WHERE booking_id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingCheck.rows[0];

    // Check if booking is already assigned
    if (booking.assigned_guide_id) {
      return res.status(400).json({
        success: false,
        message: "Booking already has an assigned guide. Please unassign first."
      });
    }

    // Only allow assignment for confirmed bookings
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot assign guide to ${booking.status} booking. Only confirmed bookings can be assigned.`
      });
    }

    // Verify guide exists and is approved
    const guideCheck = await db.query(`
      SELECT tg.guide_id, tg.full_name, u.status, tg.approved, tg.status as guide_status
      FROM tour_guides tg
      JOIN users u ON tg.user_id = u.user_id
      WHERE tg.guide_id = $1
        AND u.role = 'guide'
        AND tg.approved = true
        AND tg.status = 'approved'
    `, [guideId]);

    if (guideCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Guide not found or not approved"
      });
    }

    const guide = guideCheck.rows[0];

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Assign guide to booking using new column names
      const result = await db.query(`
        UPDATE bookings
        SET assigned_guide_id = $1,
            guide_assigned_at = CURRENT_TIMESTAMP,
            assigned_by_admin_id = $2
        WHERE booking_id = $3
        RETURNING *
      `, [guideId, adminUserId, bookingId]);

      // Create audit trail entry
      await db.query(`
        INSERT INTO guide_assignments 
          (booking_id, guide_id, assigned_by, assignment_status, admin_notes)
        VALUES ($1, $2, $3, 'active', $4)
      `, [bookingId, guideId, adminUserId, adminNotes || null]);

      // Commit transaction
      await db.query('COMMIT');

      // Fetch complete booking info with guide details
      const updatedBooking = await db.query(`
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
        LEFT JOIN tour_guides tg ON b.assigned_guide_id = tg.guide_id
        LEFT JOIN users ug ON tg.user_id = ug.user_id
        WHERE b.booking_id = $1
      `, [bookingId]);

      res.json({
        success: true,
        message: `Guide ${guide.full_name} assigned successfully`,
        booking: updatedBooking.rows[0]
      });

      // TODO: Send notification/email to guide about new assignment
      // This would be implemented in a separate notification service

    } catch (txError) {
      await db.query('ROLLBACK');
      throw txError;
    }

  } catch (err) {
    console.error("assignGuideToBooking error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to assign guide to booking" 
    });
  }
};
