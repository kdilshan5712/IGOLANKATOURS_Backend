import express from "express";
import multer from "multer";
import upload from "../middleware/upload.middleware.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  registerGuide,
  uploadGuideDocuments,
  getGuideProfile,
  getGuideDashboard,
  getGuideBookings
} from "../controllers/guide.controller.js";

const router = express.Router();

// Guide registration (public)
router.post("/register", registerGuide);

// Guide document upload (authenticated guide only)
router.post(
  "/documents",
  authenticate,
  authorize("guide"),
  upload.single("document"),
  uploadGuideDocuments
);

// Get guide profile (authenticated guide only)
router.get(
  "/me",
  authenticate,
  authorize("guide"),
  getGuideProfile
);

// Guide dashboard (authenticated active guide only)
router.get(
  "/dashboard",
  authenticate,
  authorize("guide"),
  getGuideDashboard
);

// Get assigned bookings (authenticated guide only)
router.get(
  "/bookings",
  authenticate,
  authorize("guide"),
  getGuideBookings
);

// Alias for my-tours (same as bookings)
router.get(
  "/my-tours",
  authenticate,
  authorize("guide"),
  getGuideBookings
);

export default router;
