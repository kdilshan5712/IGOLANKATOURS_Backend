import db from "../config/db.js";

/**
 * Creates or updates the availability status for a guide on a specific date.
 * Validates the date is not in the past and the guide is approved.
 * 
 * @async
 * @function setAvailability
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Availability details.
 * @param {string} req.body.date - Date for which to set availability (YYYY-MM-DD).
 * @param {string} req.body.status - Availability status ('available' or 'unavailable').
 * @param {Object} req.user - Authenticated user object.
 * @param {string} req.user.user_id - ID of the authenticated user.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming availability update.
 */
export const setAvailability = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { date, status } = req.body;

    // Validate required fields
    if (!date || !status) {
      return res.status(400).json({ 
        success: false,
        message: "Date and status are required" 
      });
    }

    // Validate status
    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: "Status must be 'available' or 'unavailable'" 
      });
    }

    // Validate date format and not in past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid date format" 
      });
    }

    if (selectedDate < today) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot set availability for past dates" 
      });
    }

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id, approved FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Guide profile not found" 
      });
    }

    const { guide_id, approved } = guideResult.rows[0];

    if (!approved) {
      return res.status(403).json({ 
        success: false,
        message: "Only approved guides can manage availability" 
      });
    }

    // Insert or update availability
    await db.query(
      `INSERT INTO guide_availability (guide_id, date, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (guide_id, date)
       DO UPDATE SET status = $3, created_at = NOW()`,
      [guide_id, date, status]
    );

    res.status(201).json({ 
      success: true,
      message: "Availability updated successfully",
      availability: { date, status }
    });
  } catch (err) {
    console.error("Guide setAvailability error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to set availability" 
    });
  }
};

/**
 * Retrieves all upcoming availability records for the authenticated guide.
 * 
 * @async
 * @function getAvailability
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated user object.
 * @param {string} req.user.user_id - ID of the authenticated user.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the guide's upcoming availability.
 */
export const getAvailability = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Guide profile not found" 
      });
    }

    const guideId = guideResult.rows[0].guide_id;

    // Get upcoming availability
    const result = await db.query(
      `SELECT 
         availability_id,
         date,
         status,
         created_at
       FROM guide_availability
       WHERE guide_id = $1 AND date >= CURRENT_DATE
       ORDER BY date ASC`,
      [guideId]
    );

    res.json({ 
      success: true,
      count: result.rows.length,
      availability: result.rows
    });
  } catch (err) {
    console.error("Guide getAvailability error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch availability" 
    });
  }
};
