/**
 * Admin Document Verification Routes
 * Path: /api/admin/documents
 * 
 * Manages the verification workflow for tour guide identity and licensing documents.
 */
import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getAllGuideDocuments,
  verifyDocument,
  rejectDocument
} from "../controllers/admin.documents.controller.js";

const router = express.Router();

// All admin document routes are protected
router.use(authenticate, authorize("admin"));

// Get all guide documents
router.get("/guide-documents", getAllGuideDocuments);

// Verify a document
router.patch("/guide-documents/:document_id/verify", verifyDocument);

// Reject a document
router.patch("/guide-documents/:document_id/reject", rejectDocument);

export default router;
