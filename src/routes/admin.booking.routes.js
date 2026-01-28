import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getAllBookings,
  getAvailableGuides,
  assignGuideToBooking,
  unassignGuideFromBooking,
  updateBookingStatus,
  getBookingDetails
} from "../controllers/admin.booking.controller.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticate, authorize("admin"));

// GET all bookings (with optional status filter)
router.get("/", getAllBookings);

// GET available guides for assignment
router.get("/available-guides", getAvailableGuides);

// GET specific booking details
router.get("/:bookingId", getBookingDetails);

// POST assign guide to booking
router.post("/:bookingId/assign-guide", assignGuideToBooking);

// POST unassign guide from booking
router.post("/:bookingId/unassign-guide", unassignGuideFromBooking);

// PATCH update booking status
router.patch("/:bookingId/status", updateBookingStatus);

export default router;
