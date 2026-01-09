import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import db from "./src/config/db.js";
import testRoutes from "./src/routes/test.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import guideRoutes from "./src/routes/guide.routes.js";

dotenv.config();

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

// Test routes (dev only)
app.use("/api/test", testRoutes);

// Authentication (tourist + login)
app.use("/api/auth", authRoutes);

// Tour Guide onboarding (register + document upload)
app.use("/api/guides", guideRoutes);

/* -------------------- ERROR HANDLING -------------------- */

// Multer / file upload errors
app.use((err, req, res, next) => {
  if (err instanceof Error && err.message.includes("Invalid file type")) {
    return res.status(400).json({ message: err.message });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File size exceeds limit" });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
