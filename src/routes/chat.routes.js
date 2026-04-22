/**
 * Communication & Chat Routes
 * Path: /api/chat
 * 
 * Facilitates real-time communication between tourists and guides for active tours, 
 * as well as archived session-based chat data.
 */
import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getTourMessages, sendTourMessage, authorizeChat, getChatbotMessages, sendChatbotMessage } from "../controllers/chat.controller.js";

const router = express.Router();

// --- Booking-based Chat ---
router.get("/:bookingId", authenticate, getTourMessages);
router.post("/:bookingId", authenticate, sendTourMessage);
router.patch("/:bookingId/authorize", authenticate, authorizeChat);

// --- Session-based Chat (Custom Inquiry) ---
router.get("/session/:sessionId", authenticate, getChatbotMessages);
router.post("/session/:sessionId", authenticate, sendChatbotMessage);

export default router;
