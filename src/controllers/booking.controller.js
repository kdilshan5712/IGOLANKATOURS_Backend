import db from "../config/db.js";

/**
 * CREATE BOOKING
 * POST /api/bookings
 * Auth: Required (Tourist only)
 */
export const createBooking = async (req, res) => {
  const { package_id, travel_date, travelers } = req.body;
  const user_id = req.user.user_id;

  try {
    // Check email verification status
    const userCheck = await db.query(
      "SELECT email_verified FROM users WHERE user_id = $1",
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!userCheck.rows[0].email_verified) {
      return res.status(403).json({
        message: "Please verify your email before making a booking. Check your inbox for the verification link.",
        error: "EMAIL_NOT_VERIFIED"
      });
    }

    // Validation
    if (!package_id || !travel_date || !travelers) {
      return res.status(400).json({
        message: "Missing required fields: package_id, travel_date, travelers"
      });
    }

    if (travelers < 1) {
      return res.status(400).json({
        message: "Travelers count must be at least 1"
      });
    }

    // Validate travel date is in the future
    const travelDateObj = new Date(travel_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (travelDateObj < today) {
      return res.status(400).json({
        message: "Travel date must be in the future"
      });
    }

    // Fetch package to get price
    const packageQuery = await db.query(
      "SELECT package_id, name, price FROM tour_packages WHERE package_id = $1",
      [package_id]
    );

    if (packageQuery.rows.length === 0) {
      return res.status(404).json({
        message: "Package not found"
      });
    }

    const packageData = packageQuery.rows[0];
    const total_price = packageData.price * travelers;

    // Create booking
    const result = await db.query(
      `INSERT INTO bookings 
       (user_id, package_id, travel_date, travelers, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING booking_id, user_id, package_id, travel_date, travelers, total_price, status, created_at`,
      [user_id, package_id, travel_date, travelers, total_price, 'confirmed']
    );

    const booking = result.rows[0];

    return res.status(201).json({
      message: "Booking created successfully",
      booking: {
        ...booking,
        package_name: packageData.name
      }
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({
      message: "Failed to create booking",
      error: error.message
    });
  }
};

/**
 * GET MY BOOKINGS
 * GET /api/bookings/my
 * Auth: Required (Tourist only)
 */
export const getMyBookings = async (req, res) => {
  const user_id = req.user.user_id;

  console.log("📋 [GET /api/bookings/my] Authenticated user_id:", user_id);
  console.log("📋 [GET /api/bookings/my] User role:", req.user.role);

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
        tg.full_name as guide_name,
        tg.contact_number as guide_phone,
        ug.email as guide_email
       FROM bookings b
       JOIN tour_packages p ON b.package_id = p.package_id
       LEFT JOIN tour_guide tg ON b.guide_id = tg.guide_id
       LEFT JOIN users ug ON tg.user_id = ug.user_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [user_id]
    );

    console.log("📋 [GET /api/bookings/my] Query executed successfully");
    console.log("📋 [GET /api/bookings/my] Found bookings:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("📋 [GET /api/bookings/my] First booking:", JSON.stringify(result.rows[0], null, 2));
    }

    return res.json({
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
