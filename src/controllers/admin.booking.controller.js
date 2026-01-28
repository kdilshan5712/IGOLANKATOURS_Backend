import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";

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
        b.booking_reference,
        b.travel_date,
        b.travelers,
        b.total_price,
        b.status,
        b.created_at,
        b.guide_id,
        u.email as user_email,
        tp.name as package_name,
        tp.duration as package_duration,
        tg.full_name as guide_name,
        gu.email as guide_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
      LEFT JOIN tour_guide tg ON b.guide_id = tg.guide_id
      LEFT JOIN users gu ON tg.user_id = gu.user_id
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
 * GET APPROVED GUIDES (for assignment dropdown)
 * GET /api/admin/bookings/available-guides
 */
export const getAvailableGuides = async (req, res) => {
  try {
    const { travel_date } = req.query;

    let query = `
      SELECT 
        tg.guide_id,
        tg.full_name,
        tg.contact_number,
        u.email,
        COUNT(b.booking_id) as active_bookings
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      LEFT JOIN bookings b ON tg.guide_id = b.guide_id 
        AND b.status IN ('confirmed', 'pending')
    `;

    const params = [];
    
    // Filter by date if provided to avoid double-booking
    if (travel_date) {
      query += ` AND b.travel_date = $1`;
      params.push(travel_date);
    }

    query += `
      WHERE tg.approved = true 
        AND u.status = 'active'
      GROUP BY tg.guide_id, tg.full_name, tg.contact_number, u.email
      ORDER BY active_bookings ASC, tg.full_name ASC
    `;

    const result = await db.query(query, params);

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
    const { guideId } = req.body;
    const adminUserId = req.user.user_id;

    console.log("[ADMIN] Assigning guide:", { bookingId, guideId, adminUserId });

    // Validate inputs
    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Guide ID is required"
      });
    }

    // Check if booking exists
    const bookingCheck = await db.query(
      `SELECT 
        b.booking_id, 
        b.status, 
        b.guide_id,
        b.travel_date,
        b.package_id,
        u.email as tourist_email,
        tp.name as package_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN tour_packages tp ON b.package_id = tp.package_id
       WHERE b.booking_id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingCheck.rows[0];

    // Check if guide exists and is approved
    const guideCheck = await db.query(
      `SELECT tg.guide_id, tg.full_name, tg.contact_number, u.email as guide_email, u.status
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide not found"
      });
    }

    const guide = guideCheck.rows[0];

    if (!guide.guide_id || guide.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: "Guide is not approved or active"
      });
    }

    // Check if guide is already assigned to another booking on the same date
    const conflictCheck = await db.query(
      `SELECT booking_id FROM bookings 
       WHERE guide_id = $1 
         AND travel_date = $2 
         AND booking_id != $3
         AND status IN ('confirmed', 'pending')`,
      [guideId, booking.travel_date, bookingId]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Guide is already assigned to another booking on this date"
      });
    }

    // Assign guide to booking
    const updateResult = await db.query(
      `UPDATE bookings 
       SET guide_id = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $2
       RETURNING *`,
      [guideId, bookingId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to assign guide"
      });
    }

    // Send email notifications
    try {
      // Email to guide
      const guideEmailData = {
        subject: "New Tour Assignment - I GO LANKA TOURS",
        html: `
          <h2>New Tour Assignment</h2>
          <p>Hello ${guide.full_name},</p>
          <p>You have been assigned to a new tour:</p>
          <ul>
            <li><strong>Package:</strong> ${booking.package_name}</li>
            <li><strong>Travel Date:</strong> ${new Date(booking.travel_date).toLocaleDateString()}</li>
            <li><strong>Booking Reference:</strong> ${bookingId}</li>
          </ul>
          <p>Please check your dashboard for more details.</p>
          <p>Thank you!</p>
        `
      };
      await sendEmail(guide.guide_email, guideEmailData.subject, guideEmailData.html);

      // Email to tourist
      const touristEmailData = {
        subject: "Tour Guide Assigned - I GO LANKA TOURS",
        html: `
          <h2>Tour Guide Assigned</h2>
          <p>Great news! A tour guide has been assigned to your booking.</p>
          <ul>
            <li><strong>Guide Name:</strong> ${guide.full_name}</li>
            <li><strong>Contact:</strong> ${guide.contact_number || 'Available in dashboard'}</li>
            <li><strong>Package:</strong> ${booking.package_name}</li>
            <li><strong>Travel Date:</strong> ${new Date(booking.travel_date).toLocaleDateString()}</li>
          </ul>
          <p>Your guide will contact you before your tour date.</p>
        `
      };
      await sendEmail(booking.tourist_email, touristEmailData.subject, touristEmailData.html);
    } catch (emailError) {
      console.error("[ADMIN] Failed to send assignment emails:", emailError);
      // Continue anyway - assignment succeeded
    }

    res.json({
      success: true,
      message: `Guide ${guide.full_name} assigned successfully`,
      booking: updateResult.rows[0]
    });

  } catch (err) {
    console.error("[ADMIN] assignGuideToBooking error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to assign guide to booking"
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

    // Check if booking exists and has a guide
    const bookingCheck = await db.query(
      `SELECT b.booking_id, b.guide_id, tg.full_name as guide_name
       FROM bookings b
       LEFT JOIN tour_guide tg ON b.guide_id = tg.guide_id
       WHERE b.booking_id = $1`,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingCheck.rows[0];

    if (!booking.guide_id) {
      return res.status(400).json({
        success: false,
        message: "No guide assigned to this booking"
      });
    }

    // Unassign guide
    await db.query(
      `UPDATE bookings 
       SET guide_id = NULL, 
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    res.json({
      success: true,
      message: `Guide ${booking.guide_name} unassigned successfully`
    });

  } catch (err) {
    console.error("[ADMIN] unassignGuideFromBooking error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to unassign guide"
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
        tp.name as package_name,
        tp.duration,
        tp.price as package_price,
        tg.full_name as guide_name,
        tg.contact_number as guide_contact,
        gu.email as guide_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN tour_packages tp ON b.package_id = tp.package_id
      LEFT JOIN tour_guide tg ON b.guide_id = tg.guide_id
      LEFT JOIN users gu ON tg.user_id = gu.user_id
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
