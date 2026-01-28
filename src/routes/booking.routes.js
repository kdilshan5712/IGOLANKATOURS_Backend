import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { 
  createBooking, 
  getMyBookings
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

export default router;
