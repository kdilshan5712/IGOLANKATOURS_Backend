import express from "express";
import { getActivePromotions } from "../controllers/admin.promotions.controller.js";

const router = express.Router();

// Public route to fetch active promotions
router.get("/", getActivePromotions);

export default router;
