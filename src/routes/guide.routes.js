import express from "express";
import upload from "../middleware/upload.middleware.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  registerGuide,
  uploadGuideDocuments,
  getGuideProfile,
  getGuideDashboard
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

export default router;
