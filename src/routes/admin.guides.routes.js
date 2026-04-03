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
  getApprovedGuides,
  updateGuideCommission
} from "../controllers/admin.guide.controller.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

// Specific routes before param routes
router.get("/approved", getApprovedGuides);

router.get("/test", (req, res) => {
  res.json({ success: true, message: "Test route works!", timestamp: new Date().toISOString() });
});

router.get("/", getAllGuides);
router.get("/:guideId", getGuideById);

router.post("/documents/:documentId/approve", approveDocument);
router.post("/documents/:documentId/reject", rejectDocument);

router.post("/:guideId/approve", approveGuide);
router.post("/:guideId/reject", rejectGuide);

router.patch("/:guideId/approve-action", approveGuideAction);
router.patch("/:guideId/reject-action", rejectGuideAction);

router.patch("/:guideId/commission", updateGuideCommission);

export default router;
