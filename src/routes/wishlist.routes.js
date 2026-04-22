/**
 * User Wishlist Management Routes
 * Path: /api/wishlist
 * 
 * Provides private endpoints for tourists to view their saved tour packages 
 * and toggle (add/remove) items from their personal wishlist.
 */
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getUserWishlist, toggleWishlistItem } from '../controllers/wishlist.controller.js';

const router = express.Router();

// All wishlist routes require tourist authentication
router.use(authenticate);
router.use(authorize('tourist'));

// GET /api/wishlist - Get all wishlist package IDs
router.get('/', getUserWishlist);

// POST /api/wishlist/toggle - Add/Remove package from wishlist
router.post('/toggle', toggleWishlistItem);

export default router;
