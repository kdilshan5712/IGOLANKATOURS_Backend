import express from "express";
import upload from "../middleware/upload.middleware.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  registerGuide,
  uploadGuideDocuments
} from "../controllers/guide.controller.js";

const router = express.Router();

// Guide registration
router.post("/register", registerGuide);

// Guide document upload (only guide role)
router.post(
  "/documents",
  authenticate,
  authorize("guide"),
  upload.single("document"),
  uploadGuideDocuments
);

export default router;
