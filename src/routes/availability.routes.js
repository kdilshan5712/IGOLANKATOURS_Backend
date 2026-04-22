/**
 * Guide Availability Routes
 * Path: /api/guide/availability (usually mounted under guide)
 * 
 * Manages the calendar availability for tour guides, permettant guides
 * to define when they are available for tour assignments.
 */
import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  setAvailability,
  getAvailability
} from "../controllers/availability.controller.js";

const router = express.Router();

// All availability routes are protected and guide-only
router.use(authenticate, authorize("guide"));

// Set/update availability
router.post("/availability", setAvailability);

// Get guide's availability
router.get("/availability", getAvailability);

export default router;
