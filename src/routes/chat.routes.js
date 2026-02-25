import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getTourMessages, sendTourMessage, authorizeChat } from "../controllers/chat.controller.js";

const router = express.Router();

// Get all messages for a specific booking
// Auth: Required (Tourist or Assigned Guide)
router.get("/:bookingId", authenticate, getTourMessages);

// Send a new message for a specific booking
// Auth: Required (Tourist or Assigned Guide)
router.post("/:bookingId", authenticate, sendTourMessage);

// Authorize or revoke chat access for a specific booking
// Auth: Required (Admin only)
router.patch("/:bookingId/authorize", authenticate, authorizeChat);

export default router;
