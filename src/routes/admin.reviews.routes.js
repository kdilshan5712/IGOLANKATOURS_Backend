import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  getAllReviewsAdmin,
  approveReview,
  rejectReview,
  deleteReview
} from '../controllers/review.controller.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// GET all reviews with filters (admin only)
router.get('/reviews', getAllReviewsAdmin);

// PATCH approve a review
router.patch('/reviews/:reviewId/approve', approveReview);

// PATCH reject a review with optional reason
router.patch('/reviews/:reviewId/reject', rejectReview);

// DELETE a review permanently
router.delete('/reviews/:reviewId', deleteReview);

export default router;
