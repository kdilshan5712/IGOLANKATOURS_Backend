import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getUserProfile,
  getUserBookings
} from "../controllers/user.controller.js";

const router = express.Router();

// All user routes require authentication as tourist
router.use(authenticate);
router.use(authorize("tourist"));

// GET /api/user/me - Get logged-in user profile
router.get("/me", getUserProfile);

// GET /api/user/bookings - Get all bookings for logged-in user
router.get("/bookings", getUserBookings);

export default router;
