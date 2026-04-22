/**
 * Admin Dashboard Routes
 * Path: /api/admin/dashboard
 * 
 * Provides endpoints for high-level dashboard analytics, including 
 * statistics, notification counts, revenue reports, and automated report generation.
 */
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import adminDashboardController from '../controllers/admin.dashboard.controller.js';

const router = express.Router();

// All routes are protected and require admin role
router.use(authenticate, authorize('admin'));

router.get('/stats', adminDashboardController.getDashboardStats);
router.get('/notifications/counts', adminDashboardController.getNotificationCounts);
router.get('/recent-bookings', adminDashboardController.getRecentBookings);
router.get('/revenue-report', adminDashboardController.getRevenueReport);
router.get('/generate-report', adminDashboardController.generateReport);

export default router;
