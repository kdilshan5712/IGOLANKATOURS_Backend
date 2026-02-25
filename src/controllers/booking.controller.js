import db from "../config/db.js";
import pricingService from "../services/pricing.service.js";

/**
 * CREATE BOOKING
 * POST /api/bookings
 * Auth: Required (Tourist only)
 */
export const createBooking = async (req, res) => {
  console.log("DEBUG: Booking Request Body:", JSON.stringify(req.body, null, 2));
  const { package_id, travel_date, adults, children, room_type, special_requests, travellers } = req.body;
  const user_id = req.user.user_id;

  // Use a client for transaction
  const client = await db.pool.connect();

  try {
    // Check email verification status
    const userCheck = await client.query(
      "SELECT email_verified FROM users WHERE user_id = $1",
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Enforce Email Verification
    if (!userCheck.rows[0].email_verified) {
      return res.status(403).json({
        message: "Please verify your email before making a booking. Check your inbox for the verification link.",
        error: "EMAIL_NOT_VERIFIED"
      });
    }

    // Validation
    const numAdults = parseInt(adults, 10) || 0;
    const numChildren = parseInt(children, 10) || 0;
    const totalTravelers = numAdults + numChildren;

    console.log("DEBUG: Validation Check:", {
      package_id,
      travel_date,
      totalTravelers,
      numAdults,
      numChildren,
      found_package_id: !!package_id,
      found_travel_date: !!travel_date,
      travellers_length: travellers ? travellers.length : 0
    });

    if (!package_id || !travel_date || totalTravelers < 1) {
      console.log("DEBUG: Validation FAILED (Missing fields or zero travelers)");
      return res.status(400).json({
        message: "Missing required fields or invalid traveler count",
        debug: { package_id: !!package_id, travel_date: !!travel_date, totalTravelers }
      });
    }

    if (!travellers || !Array.isArray(travellers) || travellers.length !== totalTravelers) {
      console.log(`DEBUG: Traveller Mismatch. Expected ${totalTravelers}, got ${travellers ? travellers.length : 'none'}`);
      return res.status(400).json({
        message: `Traveller details mismatch. Expected ${totalTravelers} profiles, but received ${travellers ? travellers.length : 0}.`
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

    // Fetch package to get price details
    const packageQuery = await client.query(
      "SELECT package_id, name, base_price as price, season_type, coast_type FROM tour_packages WHERE package_id = $1",
      [package_id]
    );

    if (packageQuery.rows.length === 0) {
      return res.status(404).json({
        message: "Package not found"
      });
    }

    const packageData = packageQuery.rows[0];

    // Calculate dynamic price server-side
    const pricing = await pricingService.calculateDynamicPrice(
      { ...packageData, base_price: packageData.price },
      travel_date,
      numAdults,
      numChildren
    );

    const total_price = pricing.totalPrice;
    const { seasonLabel, multiplier } = pricing;

    // Generate Booking Reference (e.g., BOOK-2026-A1B2C3D4)
    const year = new Date().getFullYear();
    const uniqueSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    const booking_reference = `BOOK-${year}-${uniqueSuffix}`;

    // Start Transaction
    await client.query('BEGIN');

    // Create booking (Only insert columns that exist in the schema)
    const result = await client.query(
      `INSERT INTO bookings 
       (user_id, package_id, travel_date, travelers, total_price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [user_id, package_id, travel_date, totalTravelers, total_price, 'confirmed']
    );

    const booking = result.rows[0];
    const bookingId = booking.booking_id;

    // Note: The original implementation attempted to insert into 'booking_travellers' here,
    // but the actual DB schema does not have this table. Traveller count is stored 
    // directly on the bookings table.

    // Commit Transaction
    await client.query('COMMIT');

    // Send notification to user (Async, handled outside transaction)
    // We can use setTimeout to not block response, or just await it if fast enough. 
    // Since notifications might fail, we wrap in try/catch inside controller but outside transaction logic if possible.
    // Here we kept it inside try block but after commit logic conceptually.

    try {
      const { NotificationService } = await import('../utils/notificationService.js');

      // 1. Send In-App Notification (Pending Payment)
      await NotificationService.create({
        userId: user_id,
        type: 'booking',
        title: 'Booking Created',
        message: `Your booking for ${packageData.name} is drafted. Please complete payment.`,
        link: `/booking/${bookingId}/payment`
      });

      // Email logic usually happens after payment confirmation, so skipping here for "pending" booking
    } catch (notifError) {
      console.error('Notification error (non-critical):', notifError);
    }

    return res.status(201).json({
      message: "Booking drafted successfully. Proceed to payment.",
      booking: {
        ...booking,
        package_name: packageData.name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating booking:", error);
    return res.status(500).json({
      message: "Failed to create booking",
      error: error.message
    });
  } finally {
    client.release();
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
        b.assigned_guide_id,
        b.guide_assigned_at,
        p.name as package_name,
        p.duration,
        p.image,
        p.category,
        tg.full_name as guide_name,
        tg.contact_number as guide_phone,
        ug.email as guide_email
       FROM bookings b
       JOIN tour_packages p ON b.package_id = p.package_id
       LEFT JOIN tour_guide tg ON b.assigned_guide_id = tg.guide_id
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

/**
 * CANCEL BOOKING
 * POST /api/bookings/:id/cancel
 * Auth: Required (Tourist only - must own the booking)
 */
export const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;
  const { reason } = req.body;

  try {
    // Get booking details
    const bookingResult = await db.query(
      `SELECT b.*, p.name as package_name, p.base_price as price
       FROM bookings b
       JOIN tour_packages p ON b.package_id = p.package_id
       WHERE b.booking_id = $1`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Verify ownership
    if (booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Check if already completed
    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking'
      });
    }

    // Calculate refund based on cancellation policy
    const travelDate = new Date(booking.travel_date);
    const now = new Date();
    const daysUntilTravel = Math.ceil((travelDate - now) / (1000 * 60 * 60 * 24));

    let refundPercentage = 0;
    if (daysUntilTravel >= 30) {
      refundPercentage = 100; // Full refund
    } else if (daysUntilTravel >= 14) {
      refundPercentage = 75; // 75% refund
    } else if (daysUntilTravel >= 7) {
      refundPercentage = 50; // 50% refund
    } else if (daysUntilTravel >= 3) {
      refundPercentage = 25; // 25% refund
    } else {
      refundPercentage = 0; // No refund
    }

    const refundAmount = (booking.total_price * refundPercentage) / 100;

    // Update booking status with refund information
    await db.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancellation_reason = $1,
           cancelled_at = CURRENT_TIMESTAMP,
           refund_amount = $2,
           refund_percentage = $3,
           refund_status = 'pending'
       WHERE booking_id = $4`,
      [reason || 'User requested cancellation', refundAmount, refundPercentage, id]
    );

    // Import notification service
    const { NotificationService } = await import('../utils/notificationService.js');
    const { sendCancellationEmail } = await import('../utils/emailService.js');

    // Send notification to user
    await NotificationService.create({
      userId: userId,
      type: 'booking',
      title: 'Booking Cancelled',
      message: `Your booking for ${booking.package_name} has been cancelled. Refund: $${refundAmount.toFixed(2)} (${refundPercentage}%)`,
      link: `/dashboard/bookings/${id}`
    });

    // Send cancellation email
    const userProfileResult = await db.query("SELECT full_name FROM tourist WHERE user_id = $1", [userId]);
    const userProfile = userProfileResult.rows[0];

    if (userProfile) {
      await sendCancellationEmail({
        userEmail: req.user.email,
        userName: userProfile.full_name,
        bookingReference: id.substring(0, 8).toUpperCase(),
        packageName: booking.package_name,
        refundAmount: refundAmount.toFixed(2)
      });
    }

    console.log(`[BOOKING] Cancelled booking ${id} - Refund: $${refundAmount.toFixed(2)} (${refundPercentage}%)`);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      refund: {
        amount: refundAmount,
        percentage: refundPercentage,
        daysUntilTravel,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error('[BOOKING] Cancel error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
};

/**
 * DOWNLOAD INVOICE
 * GET /api/bookings/:id/invoice
 * Auth: Required (Tourist only - must own the booking)
 */
export const downloadInvoice = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const bookingResult = await db.query(
      `SELECT b.*, u.email as user_email, t.full_name as tourist_name, tp.name as package_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.user_id
       LEFT JOIN tourist t ON u.user_id = t.user_id
       LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
       WHERE b.booking_id = $1`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Verify ownership
    if (booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only download invoices for your own bookings'
      });
    }

    // Must be paid/confirmed to download invoice
    if (booking.status === 'pending' || booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is not available for drafted or cancelled bookings.'
      });
    }

    const { generateBookingInvoicePDF } = await import('../utils/reportGenerator.js');
    await generateBookingInvoicePDF(booking, res);

  } catch (err) {
    console.error('[BOOKING] Invoice generation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
};
