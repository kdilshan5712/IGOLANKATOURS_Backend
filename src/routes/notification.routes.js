import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getUserNotifications,
  markNotificationAsRead
} from "../controllers/notification.controller.js";

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Get user notifications
router.get("/", getUserNotifications);

// Mark notification as read
router.patch("/:id/read", markNotificationAsRead);

export default router;
