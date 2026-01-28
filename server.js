import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";

import db from "./src/config/db.js";
import adminReviewRoutes from "./src/routes/admin.reviews.routes.js";
import reviewRoutes from "./src/routes/reviews.routes.js";
import contactRoutes from "./src/routes/contacts.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import guideRoutes from "./src/routes/guide.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import adminDocumentsRoutes from "./src/routes/admin.documents.routes.js";
import availabilityRoutes from "./src/routes/availability.routes.js";
import packageRoutes from "./src/routes/package.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import userRoutes from "./src/routes/user.routes.js";

import adminGuideRoutes from "./src/routes/admin.guides.routes.js";
import adminDashboardRoutes from "./src/routes/admin.dashboard.routes.js";
import adminBookingRoutes from "./src/routes/admin.booking.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";

const app = express();

/* -------------------- MIDDLEWARE -------------------- */

// CORS (frontend can be restricted later)
app.use(cors());

// JSON body parser
app.use(express.json());

/* -------------------- ROUTES -------------------- */

// Health check (DB-safe, production style)
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (err) {
    console.error("❌ Health check failed:", err);

  // Admin dashboard metrics
  app.use("/api/admin/dashboard", adminDashboardRoutes);
    res.status(503).json({
      status: "error",
      database: "not connected",
      code: err.code || err.name
    });
  }
});

// Root (public)
app.get("/", (req, res) => {
  res.json({
    message: "I GO LANKA TOURS Backend Running 🚀"
  });
});

// Authentication (tourist + login)
app.use("/api/auth", authRoutes);

// Tour Guide onboarding (register + document upload)
app.use("/api/guides", guideRoutes);

// Guide availability management
app.use("/api/guides", availabilityRoutes);

// Admin routes (approve/reject guides)
app.use("/api/admin", adminRoutes);

// Admin document verification routes
app.use("/api/admin", adminDocumentsRoutes);

// Admin guide approval routes
app.use("/api/admin/guides", adminGuideRoutes);

// Admin booking management routes (includes guide assignment)
app.use("/api/admin/bookings", adminBookingRoutes);

// Reviews (public + admin moderation)
app.use("/api/reviews", reviewRoutes);

// Admin routes for reviews
app.use("/api/admin", adminReviewRoutes);

// Contact form (public + admin management)
app.use("/api/contact", contactRoutes);

// Tour packages (public browsing)
app.use("/api/packages", packageRoutes);

// Booking routes (tourist bookings)
app.use("/api/bookings", bookingRoutes);

// User routes (tourist profile and bookings management)
app.use("/api/user", userRoutes);

// Notification routes (authenticated users)
app.use("/api/notifications", notificationRoutes);

/* -------------------- ERROR HANDLING -------------------- */

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ 
    message: "Route not found",
    path: req.path 
  });
});

// Multer / file upload errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File size exceeds 10MB limit" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ message: "Too many files uploaded" });
    }
    return res.status(400).json({ message: "File upload error" });
  }

  if (err instanceof Error && err.message.includes("Invalid file type")) {
    return res.status(400).json({ message: err.message });
  }

  // Generic error handler
  console.error("❌ Unhandled error:", err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === "development";
  
  res.status(500).json({ 
    message: "Internal server error",
    ...(isDev && { error: err.message })
  });
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
