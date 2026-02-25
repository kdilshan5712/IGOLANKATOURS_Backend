import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  downloadInvoice
} from "../controllers/booking.controller.js";

const router = express.Router();

/**
 * All booking routes require authentication (tourist only)
 */

// Create new booking (tourist only)
router.post(
  "/",
  authenticate,
  authorize("tourist"),
  createBooking
);

// Get logged-in user's bookings (tourist only)
router.get(
  "/my",
  authenticate,
  authorize("tourist"),
  getMyBookings
);

// Cancel booking (tourist only - must own the booking)
router.post(
  "/:id/cancel",
  authenticate,
  authorize("tourist"),
  cancelBooking
);

// Download invoice (tourist only - must own the booking)
router.get(
  "/:id/invoice",
  authenticate,
  authorize("tourist"),
  downloadInvoice
);

export default router;
