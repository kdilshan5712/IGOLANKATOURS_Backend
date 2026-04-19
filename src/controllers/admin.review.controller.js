import db from '../config/db.js';

// GET /api/reviews (public, only approved)
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

// GET /api/reviews/package/:packageId (public, only approved)
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

// GET /api/admin/reviews (admin, all reviews)
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

// POST /api/admin/reviews/:reviewId/approve
export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    await db.query("UPDATE reviews SET status = 'approved', moderated_at = NOW() WHERE review_id = $1", [reviewId]);
    res.json({ message: 'Review approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve review', details: err.message });
  }
};

// POST /api/admin/reviews/:reviewId/reject
export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    await db.query("UPDATE reviews SET status = 'rejected', moderated_at = NOW() WHERE review_id = $1", [reviewId]);
    res.json({ message: 'Review rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject review', details: err.message });
  }
};
