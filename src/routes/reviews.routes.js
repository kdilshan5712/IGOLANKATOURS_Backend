import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { uploadReviewImages } from '../middleware/upload.middleware.js';
import {
  getAllApprovedReviews,
  getApprovedReviewsByPackage,
  getReviewsForGallery,
  submitReview,
  getAllReviewsAdmin,
  approveReview,
  rejectReview,
  deleteReview
} from '../controllers/review.controller.js';

const router = express.Router();

/**
 * Public Routes - No authentication required
 */

// GET all approved reviews (paginated) - includes images for gallery
router.get('/', getAllApprovedReviews);

// GET reviews with images for gallery page
router.get('/gallery', getReviewsForGallery);

// GET approved reviews for a specific package - includes images
router.get('/package/:packageId', getApprovedReviewsByPackage);

/**
 * Protected Routes - Tourist can submit reviews with optional images
 */

// POST submit a new review (tourist only)
// Supports text-only OR text + images (up to 5 images)
// multipart/form-data: { packageId, rating, title, comment, images[] }
router.post(
  '/', 
  authenticate, 
  authorize('tourist'), 
  uploadReviewImages.array('images', 5), // Accept up to 5 images
  submitReview
);

/**
 * Admin Routes - Admin moderation
 */

// GET all reviews with filters (admin only) - includes images
router.get('/admin/list', authenticate, authorize('admin'), getAllReviewsAdmin);

// PATCH approve a review (admin only)
router.patch('/admin/:reviewId/approve', authenticate, authorize('admin'), approveReview);

// PATCH reject a review with optional reason (admin only)
router.patch('/admin/:reviewId/reject', authenticate, authorize('admin'), rejectReview);

// DELETE a review permanently (admin only) - also deletes images from storage
router.delete('/admin/:reviewId', authenticate, authorize('admin'), deleteReview);

export default router;
