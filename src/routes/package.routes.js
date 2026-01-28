import express from "express";
import { 
  getAllPackages, 
  getPackageById,
  getFeaturedPackages,
  getCategories,
  getPackageStats
} from "../controllers/package.controller.js";

const router = express.Router();

/**
 * ALL PACKAGE ROUTES ARE PUBLIC (No authentication required)
 * Tourists can browse packages without logging in
 */

// Get featured packages (top-rated)
// GET /api/packages/featured
router.get("/featured", getFeaturedPackages);

// Get available categories
// GET /api/packages/categories
router.get("/categories", getCategories);

// Get package statistics
// GET /api/packages/stats
router.get("/stats", getPackageStats);

// Get all packages (with optional filters)
// GET /api/packages?category=Beach&budget=luxury&min_price=500&max_price=2000
router.get("/", getAllPackages);

// Get single package by ID (MUST be last to avoid route conflicts)
// GET /api/packages/:id
router.get("/:id", getPackageById);

export default router;
