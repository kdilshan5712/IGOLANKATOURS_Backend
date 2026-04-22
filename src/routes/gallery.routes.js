/**
 * Public Gallery Informational Routes
 * Path: /api/gallery
 * 
 * Provides public endpoints for retrieving curated gallery images, 
 * image categories, and general gallery statistics.
 */
import express from 'express';
import {
    getAllGalleryImages,
    getGalleryCategories,
    getGalleryStats
} from '../controllers/gallery.controller.js';

const router = express.Router();

// GET all public gallery images (supports filtering by category)
router.get('/', getAllGalleryImages);

// GET gallery categories
router.get('/categories', getGalleryCategories);

// GET gallery stats
router.get('/stats', getGalleryStats);

export default router;
