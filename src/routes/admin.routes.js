import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getPendingGuides,
  getGuideDocuments,
  approveGuide,
  rejectGuide
} from "../controllers/admin.controller.js";

const router = express.Router();

// All admin routes are protected
router.use(authenticate, authorize("admin"));

// Get all pending guides
router.get("/guides/pending", getPendingGuides);

// Get documents of a specific guide
router.get("/guides/:guideId/documents", getGuideDocuments);

// Approve guide (POST for backward compatibility, PATCH as primary)
router.patch("/guides/:guideId/approve", approveGuide);
router.post("/guides/:guideId/approve", approveGuide);

// Reject guide (POST for backward compatibility, PATCH as primary)
router.patch("/guides/:guideId/reject", rejectGuide);
router.post("/guides/:guideId/reject", rejectGuide);

export default router;
