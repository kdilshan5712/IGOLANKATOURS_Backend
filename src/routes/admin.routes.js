import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getPendingGuides,
  getGuideDocuments,
  getAllGuides,
  getGuideDetails,
  getPendingApplications,
  getApprovedGuides,
  getGuidesWithDocuments,
  getDocumentUrl
} from "../controllers/admin.controller.js";
import {
   getAllGuideDocuments,
   approveGuideDocument,
   rejectGuideDocument
} from "../controllers/admin.controller.js";
import {
  getDashboardStats,
  getRecentBookings,
  getAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getAllBookings,
  updateBookingStatus,
  getAllReviews,
  approveReview,
  rejectReview,
  getAllUsers,
  updateUserStatus,
  markMessageAsRead,
  getCustomTourRequests,
  updateCustomTourStatus
} from "../controllers/admin.extra.controller.js";
import { getContactMessages } from "../controllers/contact.controller.js";

const router = express.Router();

// All admin routes are protected
router.use(authenticate, authorize("admin"));

// Guide document approval routes (admin only)
router.get("/guide-documents", getAllGuideDocuments);
router.patch("/guide-documents/:document_id/approve", approveGuideDocument);
router.patch("/guide-documents/:document_id/reject", rejectGuideDocument);

/* ======================================================
   DASHBOARD ROUTES
   ====================================================== */
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent-bookings", getRecentBookings);

/* ======================================================
   PACKAGES MANAGEMENT
   ====================================================== */
router.get("/packages", getAllPackages);
router.post("/packages", createPackage);
router.put("/packages/:packageId", updatePackage);
router.delete("/packages/:packageId", deletePackage);

/* ======================================================
   REVIEWS MANAGEMENT
   ====================================================== */
router.get("/reviews", getAllReviews);
router.patch("/reviews/:reviewId/approve", approveReview);
router.patch("/reviews/:reviewId/reject", rejectReview);

/* ======================================================
   USERS MANAGEMENT
   ====================================================== */
router.get("/users", getAllUsers);
router.patch("/users/:userId/status", updateUserStatus);

/* ======================================================
   CONTACT MESSAGES
   ====================================================== */
router.get("/contacts", getContactMessages);
router.get("/contact-messages", getContactMessages); // Alias for spec compliance
router.patch("/contacts/:messageId/read", markMessageAsRead);

/* ======================================================
   CUSTOM TOUR REQUESTS
   ====================================================== */
router.get("/custom-tours", getCustomTourRequests);
router.patch("/custom-tours/:requestId/status", updateCustomTourStatus);

/* ======================================================
   GUIDE APPROVAL ROUTES
   ====================================================== */

// NEW: Get all guides with documents (dashboard-friendly, supports status filter)
// GET /api/admin/guides?status=pending|approved|rejected
router.get("/guides-with-docs", getGuidesWithDocuments);

// Get all guides (with optional status filter)
router.get("/guides", getAllGuides);

// Get all pending guide applications (using view)
router.get("/guides/pending", getPendingGuides);

// Get pending applications (alternative endpoint using database view)
router.get("/guides/applications/pending", getPendingApplications);

// Get all approved guides (using view)
router.get("/guides/approved", getApprovedGuides);

// Get specific guide details
router.get("/guides/:guideId", getGuideDetails);

// Get documents of a specific guide
router.get("/guides/:guideId/documents", getGuideDocuments);

// Get document URL (for viewing)
router.get("/guides/:guideId/documents/:documentId/url", getDocumentUrl);

export default router;
