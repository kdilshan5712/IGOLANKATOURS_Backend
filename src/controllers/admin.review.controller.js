import db from '../config/db.js';

/**
 * Retrieves all reviews that have been approved by an administrator.
 * 
 * @async
 * @function getAllApprovedReviews
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of approved reviews.
 */
export const getAllApprovedReviews = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.review_id, r.rating, r.title, r.comment, r.images, r.created_at, 
             COALESCE(t.full_name, u.email) as user_name, p.name as package_name
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_packages p ON r.package_id = p.package_id
      WHERE r.status = 'approved'
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews', details: err.message });
  }
};

/**
 * Fetches all approved reviews for a specific tour package.
 * 
 * @async
 * @function getApprovedReviewsByPackage
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.packageId - ID of the package to fetch reviews for.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the package's approved reviews.
 */
export const getApprovedReviewsByPackage = async (req, res) => {
  try {
    const { packageId } = req.params;
    const result = await db.query(`
      SELECT r.review_id, r.rating, r.title, r.comment, r.images, r.created_at, 
             COALESCE(t.full_name, u.email) as user_name, p.name as package_name
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_packages p ON r.package_id = p.package_id
      WHERE r.status = 'approved' AND r.package_id = $1
      ORDER BY r.created_at DESC
    `, [packageId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch package reviews', details: err.message });
  }
};

/**
 * Retrieves all reviews (pending, approved, or rejected) for administrative management.
 * 
 * @async
 * @function getAllReviewsAdmin
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of all reviews.
 */
export const getAllReviewsAdmin = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.review_id, r.rating, r.title, r.comment, r.images, r.created_at, r.status, r.booking_id,
             COALESCE(t.full_name, u.email) as user_name, p.name as package_name
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      LEFT JOIN tour_packages p ON r.package_id = p.package_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all reviews', details: err.message });
  }
};

/**
 * Approves a review, updates the database, and sends a notification email to the reviewer.
 * 
 * @async
 * @function approveReview
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.reviewId - ID of the review to approve.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming approval.
 */
export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Fetch user info before updating
    const reviewRes = await db.query(`
      SELECT r.user_id, COALESCE(t.full_name, u.email) as full_name, u.email
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      WHERE r.review_id = $1
    `, [reviewId]);

    await db.query("UPDATE reviews SET status = 'approved', moderated_at = NOW() WHERE review_id = $1", [reviewId]);

    // Send approval email notification
    if (reviewRes.rows.length > 0) {
      try {
        const { sendEmail, emailTemplates } = await import('../utils/sendEmail.js');
        const user = reviewRes.rows[0];
        const emailContent = emailTemplates.reviewApproved(user.full_name || user.email.split('@')[0]);
        await sendEmail(user.email, emailContent.subject, emailContent.html);
        console.log(`✅ Review approved email sent to ${user.email}`);
      } catch (emailErr) {
        console.error('❌ Failed to send review approval email:', emailErr.message);
      }
    }

    res.json({ message: 'Review approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve review', details: err.message });
  }
};

/**
 * Rejects a review, updates the database, and sends a notification email to the reviewer
 * with the provided reason.
 * 
 * @async
 * @function rejectReview
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.reviewId - ID of the review to reject.
 * @param {Object} req.body - Request body.
 * @param {string} [req.body.reason] - Reason for rejecting the review.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming rejection.
 */
export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    // Fetch user info before updating
    const reviewRes = await db.query(`
      SELECT r.user_id, COALESCE(t.full_name, u.email) as full_name, u.email
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      WHERE r.review_id = $1
    `, [reviewId]);

    await db.query("UPDATE reviews SET status = 'rejected', moderated_at = NOW() WHERE review_id = $1", [reviewId]);

    // Send rejection email notification
    if (reviewRes.rows.length > 0) {
      try {
        const { sendEmail, emailTemplates } = await import('../utils/sendEmail.js');
        const user = reviewRes.rows[0];
        const emailContent = emailTemplates.reviewRejected(user.full_name || user.email.split('@')[0], reason);
        await sendEmail(user.email, emailContent.subject, emailContent.html);
        console.log(`✅ Review rejected email sent to ${user.email}`);
      } catch (emailErr) {
        console.error('❌ Failed to send review rejection email:', emailErr.message);
      }
    }

    res.json({ message: 'Review rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject review', details: err.message });
  }
};
