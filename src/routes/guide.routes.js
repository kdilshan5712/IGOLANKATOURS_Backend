import express from "express";
import multer from "multer";
import upload from "../middleware/upload.middleware.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  registerGuide,
  uploadGuideDocuments,
  getGuideProfile,
  getGuideDashboard,
  getGuideBookings,
  uploadProfilePhoto,
  deleteProfilePhoto,
  updateGuideProfile,
  getRejectionDetails,
  resubmitApplication,
  getGuideDashboardStats,
  getAvailability,
  setAvailability,
  markTourCompleted,
  getGuideReviews,
  updateBankDetails,
  requestPayout,
  getPayoutHistory
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

// Update guide profile (authenticated guide only)
router.put(
  "/me",
  authenticate,
  authorize("guide"),
  updateGuideProfile
);

// Upload profile photo (authenticated guide only)
router.post(
  "/profile-photo",
  authenticate,
  authorize("guide"),
  upload.single("profile_photo"),
  uploadProfilePhoto
);

// Delete profile photo (authenticated guide only)
router.delete(
  "/profile-photo",
  authenticate,
  authorize("guide"),
  deleteProfilePhoto
);

// Guide dashboard (authenticated active guide only)
router.get(
  "/dashboard",
  authenticate,
  authorize("guide"),
  getGuideDashboard
);

// Get guide bookings (authenticated guide only)
router.get(
  "/bookings",
  authenticate,
  authorize("guide"),
  getGuideBookings
);

// Get rejection details (authenticated rejected guide only)
router.get(
  "/rejection-details",
  authenticate,
  authorize("guide"),
  getRejectionDetails
);

// Resubmit application (authenticated rejected guide only)
router.post(
  "/resubmit",
  authenticate,
  authorize("guide"),
  resubmitApplication
);

// Get dashboard statistics (authenticated guide only)
router.get(
  "/dashboard/stats",
  authenticate,
  authorize("guide"),
  getGuideDashboardStats
);

// Get guide availability (authenticated guide only)
router.get(
  "/availability",
  authenticate,
  authorize("guide"),
  getAvailability
);

// Set guide availability (authenticated guide only)
router.post(
  "/availability",
  authenticate,
  authorize("guide"),
  setAvailability
);

// Mark tour as completed (authenticated guide only)
router.patch(
  "/bookings/:id/complete",
  authenticate,
  authorize("guide"),
  markTourCompleted
);

// Get guide reviews (authenticated guide only)
router.get(
  "/reviews",
  authenticate,
  authorize("guide"),
  getGuideReviews
);

// Update bank details (authenticated guide only)
router.put(
  "/me/bank-details",
  authenticate,
  authorize("guide"),
  updateBankDetails
);

// Request payout (authenticated active guide only)
router.post(
  "/payouts/request",
  authenticate,
  authorize("guide"),
  requestPayout
);

// Get payout history (authenticated guide only)
router.get(
  "/payouts",
  authenticate,
  authorize("guide"),
  getPayoutHistory
);

export default router;
