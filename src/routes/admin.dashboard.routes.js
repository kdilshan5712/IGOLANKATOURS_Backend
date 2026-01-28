
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import adminDashboardController from '../controllers/admin.dashboard.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize('admin'), adminDashboardController.getDashboardMetrics);
router.get('/recent-bookings', authenticate, authorize('admin'), adminDashboardController.getRecentBookings);

export default router;
