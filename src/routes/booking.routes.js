import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  downloadInvoice,
  convertCustomToBooking,
  acceptAndBookCustomTour
} from "../controllers/booking.controller.js";
import { validate } from "../middleware/validation.middleware.js";
import { bookingSchemas } from "../schemas/booking.schema.js";

const router = express.Router();

// --- Public / Private Mixed (Auth Required) ---

// Create new booking (tourist only)
router.post(
  "/",
  authenticate,
  authorize("tourist"),
  bookingSchemas.create,
  validate,
  createBooking
);

// Convert Custom Request to Booking (admin only)
router.post(
  "/convert/:sessionId",
  authenticate,
  authorize("admin"),
  convertCustomToBooking
);

// Accept and pay for custom approved tour (tourist)
router.post(
  "/accept-custom/:sessionId",
  authenticate,
  authorize("tourist"),
  acceptAndBookCustomTour
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
