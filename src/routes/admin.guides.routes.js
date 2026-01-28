import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getAllGuides,
  getAllGuidesWithDocuments,
  getGuideById,
  approveDocument,
  rejectDocument,
  approveGuide,
  rejectGuide,
  approveGuideAction,
  rejectGuideAction,
  getApprovedGuides
} from "../controllers/admin.guide.controller.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

// GET all guides (basic info)
router.get("/", getAllGuides);

// GET approved guides only (for assignment dropdown)
router.get("/approved", getApprovedGuides);

// GET guide by ID with documents
router.get("/:guideId", getGuideById);

// Approve/reject a document
router.post("/../documents/:documentId/approve", approveDocument);
router.post("/../documents/:documentId/reject", rejectDocument);

// Legacy approve/reject endpoints (kept for backward compatibility)
router.post("/:guideId/approve", approveGuide);
router.post("/:guideId/reject", rejectGuide);

// NEW: Approve/reject guide with email notifications
router.patch("/:guideId/approve-action", approveGuideAction);
router.patch("/:guideId/reject-action", rejectGuideAction);

export default router;
