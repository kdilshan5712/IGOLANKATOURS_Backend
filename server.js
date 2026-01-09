import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import db from "./src/config/db.js";
import testRoutes from "./src/routes/test.routes.js";
import authRoutes from "./src/routes/auth.routes.js";

dotenv.config();

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
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
  res.json({ message: "I GO LANKA TOURS Backend Running 🚀" });
});

// Test routes
app.use("/api/test", testRoutes);

// Auth routes
app.use("/api/auth", authRoutes);

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
