import express from "express";
import { validateCoupon } from "../controllers/coupon.controller.js";

const router = express.Router();

// Validation is public as it's used during the booking flow
router.get("/validate", validateCoupon);

export default router;
