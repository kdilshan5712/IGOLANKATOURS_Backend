import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import adminGalleryRoutes from "./src/routes/admin.gallery.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import destinationRoutes from "./src/routes/destinations.routes.js";
import chatRoutes from "./src/routes/chat.routes.js";

console.log("🔄 [SERVER] Routes loaded - Version 4.0 (Security Hardened + AI Agent)");

const app = express();

/* -------------------- SECURITY MIDDLEWARE -------------------- */

// 1. HTTP Security Headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embeds (e.g., maps on frontend)
  contentSecurityPolicy: false,     // Managed by frontend instead
}));

// 2. Restrict CORS to the known frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:3000", // dev fallback
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} is not allowed.`));
    }
  },
  credentials: true,
}));

// 3. Global rate limiter — 1000 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." }
});
app.use(globalLimiter);

// 4. Strict rate limiter for auth endpoints — 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." }
});

// 5. JSON body parser with a 10kb payload size limit (prevents payload flooding)
app.use(express.json({ limit: "10kb" }));

/* -------------------- ROUTES -------------------- */

// Simple ping (no DB required)
app.get("/ping", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Health check (DB-safe, production style)
app.get("/health", async (req, res) => {
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    await Promise.race([
      db.query("SELECT 1"),
      timeoutPromise
    ]);

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (err) {
    console.error("❌ Health check failed:", err.message);
    res.status(503).json({
      status: "degraded",
      database: "not connected",
      message: "Database connection timeout - it may be waking up"
    });
  }
});

// Root (public)
app.get("/", (req, res) => {
  res.json({
    message: "I GO LANKA TOURS Backend Running 🚀",
    version: "2.0-UPDATED",
    timestamp: new Date().toISOString()
  });
});

// Authentication (tourist + login) — strict rate limit applied
app.use("/api/auth", authLimiter, authRoutes);

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

// Admin dashboard metrics
app.use("/api/admin/dashboard", adminDashboardRoutes);

// Admin booking management routes (includes guide assignment)
app.use("/api/admin/bookings", adminBookingRoutes);

// Admin gallery management routes
app.use("/api/admin/gallery", adminGalleryRoutes);

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

// Payment routes (Stripe integration)
app.use("/api/payments", paymentRoutes);

// Destinations routes (public)
app.use("/api/destinations", destinationRoutes);

// Chat routes (tour guide & tourist)
app.use("/api/chat", chatRoutes);

// AI Agent — proxy to Python FastAPI microservice on port 8000
// The Python service handles: /api/ai/chat, /api/ai/weather, /api/ai/recommend
app.use("/api/ai", async (req, res) => {
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
  const targetUrl = `${AI_SERVICE_URL}${req.originalUrl}`;

  try {
    const { default: fetch } = await import("node-fetch");
    const headers = {
      "Content-Type": "application/json",
      // Forward the Authorization header so Python service can optionally validate
      ...(req.headers.authorization && { "Authorization": req.headers.authorization }),
    };

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    const data = await proxyRes.json();
    res.status(proxyRes.status).json(data);

  } catch (err) {
    console.error("❌ [AI Proxy] Failed to reach AI service:", err.message);
    res.status(503).json({
      success: false,
      message: "AI service is currently unavailable. Please try again shortly.",
    });
  }
});

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
