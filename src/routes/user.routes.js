import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";
import {
  getUserProfile,
  getUserBookings,
  uploadProfilePhoto,
  deleteProfilePhoto
} from "../controllers/user.controller.js";

const router = express.Router();

// All user routes require authentication as tourist
router.use(authenticate);
router.use(authorize("tourist"));

// GET /api/user/me - Get logged-in user profile
router.get("/me", getUserProfile);

// GET /api/user/bookings - Get all bookings for logged-in user
router.get("/bookings", getUserBookings);

// POST /api/user/profile-photo - Upload tourist profile photo
router.post(
  "/profile-photo",
  upload.single("profile_photo"),
  uploadProfilePhoto
);

// DELETE /api/user/profile-photo - Delete tourist profile photo
router.delete("/profile-photo", deleteProfilePhoto);

export default router;
