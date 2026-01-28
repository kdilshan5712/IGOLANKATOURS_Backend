import db from '../config/db.js';

// GET /api/reviews (public, only approved)
export const getAllApprovedReviews = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.review_id, r.rating, r.comment, r.created_at, u.full_name as user_name, p.name as package_name
      FROM review r
      JOIN users u ON r.user_id = u.user_id
      JOIN tour_package p ON r.package_id = p.package_id
      WHERE r.approved = true
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
      SELECT r.review_id, r.rating, r.comment, r.created_at, u.full_name as user_name, p.name as package_name
      FROM review r
      JOIN users u ON r.user_id = u.user_id
      JOIN tour_package p ON r.package_id = p.package_id
      WHERE r.approved = true AND r.package_id = $1
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
      SELECT r.review_id, r.rating, r.comment, r.created_at, r.approved, u.full_name as user_name, p.name as package_name
      FROM review r
      JOIN users u ON r.user_id = u.user_id
      JOIN tour_package p ON r.package_id = p.package_id
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
    await db.query('UPDATE review SET approved = true WHERE review_id = $1', [reviewId]);
    res.json({ message: 'Review approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve review', details: err.message });
  }
};

// POST /api/admin/reviews/:reviewId/reject
export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    await db.query('UPDATE review SET approved = false WHERE review_id = $1', [reviewId]);
    res.json({ message: 'Review rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject review', details: err.message });
  }
};
