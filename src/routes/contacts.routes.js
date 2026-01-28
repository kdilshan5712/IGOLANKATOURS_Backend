import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  submitContactMessage,
  getContactMessages,
  getContactMessage,
  updateContactMessage,
  deleteContactMessage,
  markMessageAsRead
} from '../controllers/contact.controller.js';

const router = express.Router();

/**
 * Public Routes - No authentication required
 */

// POST submit contact form message (public)
router.post('/', submitContactMessage);

/**
 * Admin Routes - Admin management and response
 */

// GET all contact messages with filters (admin only)
router.get('/admin', authenticate, authorize('admin'), getContactMessages);

// GET single contact message (admin only, auto-marks as read)
router.get('/admin/:messageId', authenticate, authorize('admin'), getContactMessage);

// PATCH update contact message status and notes (admin only)
router.patch('/admin/:messageId', authenticate, authorize('admin'), updateContactMessage);

// PATCH mark message as read (admin only - shortcut endpoint)
router.patch('/admin/:messageId/read', authenticate, authorize('admin'), markMessageAsRead);

// DELETE contact message (admin only)
router.delete('/admin/:messageId', authenticate, authorize('admin'), deleteContactMessage);

export default router;
