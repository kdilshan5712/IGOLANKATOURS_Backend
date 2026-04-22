/**
 * User Notification Management Routes
 * Path: /api/notifications
 * 
 * Provides endpoints for retrieving and managing user alerts, 
 * including unread counts and status updates (marking as read/delete).
 */
import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification
} from "../controllers/notification.controller.js";

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Get user notifications
router.get("/", getUserNotifications);

// Get unread count
router.get("/unread-count", getUnreadCount);

// Mark notification as read
router.patch("/:id/read", markNotificationAsRead);

// Mark all as read
router.put("/mark-all-read", markAllAsRead);

// Delete notification
router.delete("/:id", deleteNotification);

export default router;
