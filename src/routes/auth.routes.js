import express from "express";
import { 
  registerTourist, 
  login, 
  verifyEmail, 
  resendVerification,
  forgotPassword,
  resetPassword 
} from "../controllers/auth.controller.js";
import db from "../config/db.js";
import { validate } from "../middleware/validation.middleware.js";
import { authSchemas } from "../schemas/auth.schema.js";

const router = express.Router();

// Registration & Login
router.post("/register", authSchemas.register, validate, registerTourist);  // Tourist registration
router.post("/login", authSchemas.login, validate, login);               // All roles login

// Email Verification
router.get("/verify-email", verifyEmail);   // Verify email token
router.post("/resend-verification", resendVerification); // Resend verification email

// Password Reset
router.post("/forgot-password", forgotPassword); // Request password reset
router.post("/reset-password", authSchemas.resetPassword, validate, resetPassword);   // Reset password with token

export default router;
