/**
 * Admin Gallery Management Routes
 * Path: /api/admin/gallery
 * 
 * Provides endpoints for managing the public gallery, including 
 * image uploads, category management, reordering, and analytics.
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { uploadSingleImage } from '../middleware/upload.middleware.js';
import {
  getAllGalleryImages,
  getGalleryCategories,
  uploadGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  reorderGalleryImages,
  getGalleryStats
} from '../controllers/gallery.controller.js';

const router = express.Router();

/**
 * Admin Gallery Management Routes
 */

// GET all gallery images with filters
router.get(
  '/',
  authenticate,
  authorize('admin'),
  getAllGalleryImages
);

// GET gallery categories
router.get(
  '/categories',
  authenticate,
  authorize('admin'),
  getGalleryCategories
);

// GET gallery statistics
router.get(
  '/stats',
  authenticate,
  authorize('admin'),
  getGalleryStats
);

// POST upload new gallery image
router.post(
  '/upload',
  authenticate,
  authorize('admin'),
  uploadSingleImage.single('image'),
  uploadGalleryImage
);

// PATCH update gallery image details
router.patch(
  '/:galleryId',
  authenticate,
  authorize('admin'),
  updateGalleryImage
);

// DELETE gallery image
router.delete(
  '/:galleryId',
  authenticate,
  authorize('admin'),
  deleteGalleryImage
);

// PATCH reorder gallery images
router.patch(
  '/reorder',
  authenticate,
  authorize('admin'),
  reorderGalleryImages
);

export default router;
