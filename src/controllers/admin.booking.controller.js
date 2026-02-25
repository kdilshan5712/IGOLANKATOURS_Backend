import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";
import { NotificationService } from "../utils/notificationService.js";

/**
 * GET ALL BOOKINGS (Admin)
 * GET /api/admin/bookings
 */
export const getAllBookings = async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        b.booking_id,
        b.status,
        b.travel_date,
        b.travelers as travelers_count,
        b.total_price,
        b.created_at,
        b.assigned_guide_id,
        b.admin_notes,
        b.guide_assigned_at,
        b.is_chat_authorized,
        u.email as user_email,
        t.full_name as tourist_name,
        t.phone as tourist_phone,
        tp.name as package_name,
        tp.duration as package_duration,
        tg.full_name as guide_name,
        ug.email as guide_email,
        tg.contact_number as guide_phone
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
      LEFT JOIN tour_guide tg ON b.assigned_guide_id = tg.guide_id
      LEFT JOIN users ug ON tg.user_id = ug.user_id
    `;

    const params = [];
    if (status) {
      query += ` WHERE b.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY b.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (err) {
    console.error("[ADMIN] getAllBookings error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings"
    });
  }
};

/**
 * UPDATE BOOKING STATUS
 * PATCH /api/admin/bookings/:bookingId/status
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const result = await db.query(
      `UPDATE bookings 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $2
       RETURNING *`,
      [status, bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking: result.rows[0]
    });

  } catch (err) {
    console.error("[ADMIN] updateBookingStatus error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update booking status"
    });
  }
};

/**
 * GET BOOKING DETAILS
 * GET /api/admin/bookings/:bookingId
 */
export const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await db.query(
      `SELECT 
        b.*,
        u.email as tourist_email,
        t.full_name as tourist_name,
        tp.name as package_name,
        tp.duration,
        tp.price as package_price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
      WHERE b.booking_id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      booking: result.rows[0]
    });

  } catch (err) {
    console.error("[ADMIN] getBookingDetails error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking details"
    });
  }
};

/**
 * GET AVAILABLE GUIDES
 * GET /api/admin/bookings/available-guides
 */
export const getAvailableGuides = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        tg.guide_id,
        tg.full_name,
        tg.contact_number,
        tg.profile_photo,
        u.email
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      WHERE tg.approved = true
        AND u.status = 'active'
      ORDER BY tg.full_name ASC
    `);

    res.json({
      success: true,
      guides: result.rows
    });
  } catch (err) {
    console.error("[ADMIN] getAvailableGuides error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available guides"
    });
  }
};

/**
 * ASSIGN GUIDE TO BOOKING
 * POST /api/admin/bookings/:bookingId/assign-guide
 */
export const assignGuideToBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { guideId, adminNotes } = req.body;
    const adminUserId = req.user?.user_id;

    // Validate required parameters
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required in URL"
      });
    }

    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Guide ID is required"
      });
    }

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Validate UUID format for guideId (must be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(String(guideId))) {
      console.error(`[ASSIGN-GUIDE] ❌ Invalid guide ID format: ${guideId} (type: ${typeof guideId})`);
      return res.status(400).json({
        success: false,
        message: "Invalid guide ID format. Expected UUID string.",
        guideIdReceived: guideId,
        guideIdType: typeof guideId
      });
    }

    console.log(`[ASSIGN-GUIDE] Starting guide assignment: booking=${bookingId}, guide=${guideId}, admin=${adminUserId}`);

    // Verify booking exists and is confirmed
    console.log(`[ASSIGN-GUIDE] Checking booking ${bookingId}...`);
    const bookingCheck = await db.query(
      `SELECT booking_id, status, assigned_guide_id, user_id, package_id, travel_date 
       FROM bookings WHERE booking_id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      console.log(`[ASSIGN-GUIDE] ❌ Booking ${bookingId} not found`);
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingCheck.rows[0];
    console.log(`[ASSIGN-GUIDE] ✅ Booking found: status=${booking.status}`);

    if (booking.status !== 'confirmed') {
      console.log(`[ASSIGN-GUIDE] ❌ Booking status is '${booking.status}', not 'confirmed'`);
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be assigned to guides"
      });
    }

    // Verify guide exists and is approved
    console.log(`[ASSIGN-GUIDE] Checking guide ${guideId}...`);
    const guideCheck = await db.query(
      `SELECT tg.guide_id, tg.full_name, u.email as guide_email
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1 AND tg.approved = true`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      console.log(`[ASSIGN-GUIDE] ❌ Guide ${guideId} not found or not approved`);
      return res.status(404).json({
        success: false,
        message: "Guide not found or not approved"
      });
    }

    const guide = guideCheck.rows[0];
    console.log(`[ASSIGN-GUIDE] ✅ Guide found: ${guide.full_name} (${guide.guide_email})`);

    // Assign guide to booking
    console.log(`[ASSIGN-GUIDE] Updating booking assignment...`);
    await db.query(
      `UPDATE bookings 
       SET assigned_guide_id = $1,
           guide_assigned_at = CURRENT_TIMESTAMP,
           guide_assigned_by = $2,
           admin_notes = $3
       WHERE booking_id = $4`,
      [guideId, adminUserId, adminNotes, bookingId]
    );
    console.log(`[ASSIGN-GUIDE] ✅ Booking updated`);

    // Get updated booking with all details including travel dates
    console.log(`[ASSIGN-GUIDE] Fetching updated booking details...`);
    const updatedBooking = await db.query(
      `SELECT 
        b.*,
        tp.name as package_name,
        tp.duration,
        t.full_name as tourist_name,
        u.email as tourist_email,
        tg.full_name as guide_name,
        tg.contact_number as guide_phone,
        ug.email as guide_email
       FROM bookings b
       LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
       LEFT JOIN users u ON b.user_id = u.user_id
       LEFT JOIN tourist t ON u.user_id = t.user_id
       LEFT JOIN tour_guide tg ON b.assigned_guide_id = tg.guide_id
       LEFT JOIN users ug ON tg.user_id = ug.user_id
       WHERE b.booking_id = $1`,
      [bookingId]
    );

    const bookingDetails = updatedBooking.rows[0];

    if (!bookingDetails) {
      console.log(`[ASSIGN-GUIDE] ❌ Could not retrieve booking details after assignment`);
      return res.status(400).json({
        success: false,
        message: "Booking not found after assignment. This may indicate missing related data (package, user, or tourist)."
      });
    }

    console.log(`[ASSIGN-GUIDE] ✅ Booking details retrieved. Travel date: ${bookingDetails.travel_date}, Duration: ${bookingDetails.duration}`);

    // Calculate end date based on travel_date and package duration
    // Validate and parse dates safely with comprehensive error handling
    let startDate = new Date(); // Default to today
    let endDate = new Date();   // Default to today

    try {
      // Parse duration safely
      let durationDays = 1; // Default duration

      if (bookingDetails.duration) {
        // Extract number from duration string (e.g., "5 Days" -> 5)
        const durationMatch = String(bookingDetails.duration).match(/\d+/);
        if (durationMatch) {
          const parsed = parseInt(durationMatch[0], 10);
          if (!isNaN(parsed) && parsed > 0) {
            durationDays = parsed;
          }
        }
      }

      // Parse travel date
      if (bookingDetails.travel_date) {
        const travelDateStr = String(bookingDetails.travel_date).trim();

        if (travelDateStr && travelDateStr !== 'null' && travelDateStr !== 'undefined') {
          const parsedDate = new Date(travelDateStr);

          // Check if date is valid
          if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > 0) {
            startDate = new Date(parsedDate); // Create a copy
            endDate = new Date(parsedDate);
            endDate.setDate(endDate.getDate() + durationDays);

            console.log(`[ASSIGN-GUIDE] ✅ Dates calculated: start=${startDate.toISOString()}, end=${endDate.toISOString()}, duration=${durationDays} days`);
          } else {
            console.warn(`[ASSIGN-GUIDE] ⚠️  Invalid travel_date value: ${bookingDetails.travel_date}`);
          }
        }
      }
    } catch (dateErr) {
      console.warn(`[ASSIGN-GUIDE] ⚠️  Error parsing dates: ${dateErr.message}`);
      // Use default dates (today)
    }

    console.log(`[ASSIGN-GUIDE] Final dates - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

    // Send email notification to guide
    try {
      // Check that we have required data for email
      if (!bookingDetails.tourist_name || !bookingDetails.package_name || !guide.guide_email) {
        console.log(`[ASSIGN-GUIDE] ⚠️  Missing data for email - tourist: ${bookingDetails.tourist_name}, package: ${bookingDetails.package_name}, email: ${guide.guide_email}`);
        // Continue without email if data is missing
      } else {
        // Use validated dates instead of raw booking data
        // Use new email service
        const { sendGuideAssignment } = await import('../utils/emailService.js');

        await sendGuideAssignment({
          guideEmail: guide.guide_email,
          guideName: guide.full_name,
          bookingReference: bookingId.substring(0, 8).toUpperCase(),
          packageName: bookingDetails.package_name,
          travelDate: startDate,
          touristName: bookingDetails.tourist_name
        });

        console.log(`[ASSIGN-GUIDE] ✅ Guide assignment email sent to ${guide.guide_email}`);
      }
    } catch (emailErr) {
      console.error('[ASSIGN-GUIDE] ⚠️  Failed to send guide notification email:', emailErr.message);
      // Don't fail the assignment if email fails
    }

    // Create in-app notification
    try {
      const guideUserIdResult = await db.query('SELECT user_id FROM tour_guide WHERE guide_id = $1', [guideId]);
      if (guideUserIdResult.rows.length > 0) {
        const guideUserId = guideUserIdResult.rows[0].user_id;
        await NotificationService.notifyGuideAssignment(
          guideUserId,
          bookingDetails.package_name,
          startDate
        );
        console.log(`[ASSIGN-GUIDE] ✅ In-app notification created for guide user ${guideUserId}`);
      }
    } catch (notifErr) {
      console.error('[ASSIGN-GUIDE] ⚠️  Failed to create in-app notification:', notifErr.message);
    }

    console.log(`[ASSIGN-GUIDE] ✅ SUCCESS - Guide ${guide.full_name} assigned to booking ${bookingId}`);

    res.json({
      success: true,
      message: `Guide ${guide.full_name} assigned successfully`,
      booking: bookingDetails
    });
  } catch (err) {
    console.error("[ADMIN] assignGuideToBooking error:", err.message);
    console.error("Full error:", err);

    // Provide more specific error messages
    let statusCode = 500;
    let errorMessage = "Failed to assign guide";

    if (err.message && err.message.includes('unique violation')) {
      statusCode = 409;
      errorMessage = "Guide is already assigned to this booking";
    } else if (err.message && err.message.includes('foreign key')) {
      statusCode = 400;
      errorMessage = "Invalid guide or booking reference";
    } else if (err.message && err.message.includes('undefined')) {
      statusCode = 400;
      errorMessage = "Missing required fields (guide ID, booking ID)";
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * UNASSIGN GUIDE FROM BOOKING
 * POST /api/admin/bookings/:bookingId/unassign-guide
 */
export const unassignGuideFromBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await db.query(
      `UPDATE bookings 
       SET assigned_guide_id = NULL,
           guide_assigned_at = NULL,
           guide_assigned_by = NULL,
           admin_notes = NULL
       WHERE booking_id = $1
       RETURNING *`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      message: "Guide unassigned successfully",
      booking: result.rows[0]
    });
  } catch (err) {
    console.error("[ADMIN] unassignGuideFromBooking error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to unassign guide"
    });
  }
};
