import db from "../config/db.js";

/**
 * GET USER PROFILE
 * GET /api/user/me
 * Auth: Required (Tourist only)
 */
export const getUserProfile = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await db.query(
      `SELECT 
        u.user_id,
        u.email,
        u.role,
        u.created_at,
        t.full_name,
        t.phone,
        t.country
      FROM users u
      LEFT JOIN tourist t ON u.user_id = t.user_id
      WHERE u.user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const profile = result.rows[0];
    
    // Split full_name into first_name and last_name for frontend compatibility
    if (profile.full_name) {
      const nameParts = profile.full_name.split(' ');
      profile.first_name = nameParts[0] || '';
      profile.last_name = nameParts.slice(1).join(' ') || '';
    } else {
      profile.first_name = '';
      profile.last_name = '';
    }

    return res.json({
      message: "Profile retrieved successfully",
      profile
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};

/**
 * GET USER BOOKINGS
 * GET /api/user/bookings
 * Auth: Required (Tourist only)
 */
export const getUserBookings = async (req, res) => {
  const user_id = req.user.user_id;

  console.log("📋 [GET /api/user/bookings] Authenticated user_id:", user_id);
  console.log("📋 [GET /api/user/bookings] User role:", req.user.role);

  try {
    const result = await db.query(
      `SELECT 
        b.booking_id,
        b.user_id,
        b.package_id,
        b.travel_date,
        b.travelers,
        b.total_price,
        b.status,
        b.created_at,
        p.name as package_name,
        p.duration,
        p.image,
        p.category
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
      [user_id]
    );

    console.log("📋 [GET /api/user/bookings] Query executed successfully");
    console.log("📋 [GET /api/user/bookings] Found bookings:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("📋 [GET /api/user/bookings] First booking:", JSON.stringify(result.rows[0], null, 2));
    }

    return res.json({
      message: "Bookings retrieved successfully",
      bookings: result.rows
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      message: "Failed to fetch bookings",
      error: error.message
    });
  }
};

/**
 * CANCEL BOOKING
 * PUT /api/user/bookings/:bookingId/cancel
 * Auth: Required (Tourist only)
 */
export const cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  const user_id = req.user.user_id;

  try {
    // Check if booking exists and belongs to user
    const bookingCheck = await db.query(
      `SELECT booking_id, travel_date, status 
       FROM bookings 
       WHERE booking_id = $1 AND user_id = $2`,
      [bookingId, user_id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    const booking = bookingCheck.rows[0];

    // Check if already cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        message: "Booking is already cancelled"
      });
    }

    // Check if travel date is in the future
    const travelDate = new Date(booking.travel_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (travelDate <= today) {
      return res.status(400).json({
        message: "Cannot cancel booking for past or current date"
      });
    }

    // Update booking status to cancelled
    await db.query(
      `UPDATE bookings 
       SET status = 'cancelled'
       WHERE booking_id = $1`,
      [bookingId]
    );

    return res.json({
      message: "Booking cancelled successfully"
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return res.status(500).json({
      message: "Failed to cancel booking",
      error: error.message
    });
  }
};
