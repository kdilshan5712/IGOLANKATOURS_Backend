import express from "express";
import { registerTourist, login } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", registerTourist); // tourist only
router.post("/login", login);               // all roles

export default router;
