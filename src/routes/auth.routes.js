import express from "express";
import { 
  registerTourist, 
  login, 
  verifyEmail, 
  resendVerification,
  forgotPassword,
  resetPassword,
  socialLogin,
  refreshToken,
  logout
} from "../controllers/auth.controller.js";
import db from "../config/db.js";
import { validate } from "../middleware/validation.middleware.js";
import { authSchemas } from "../schemas/auth.schema.js";

const router = express.Router();

// Registration & Login
router.post("/register", authSchemas.register, validate, registerTourist);  // Tourist registration
router.post("/login", authSchemas.login, validate, login);               // All roles login
router.post("/social-login", socialLogin);                               // Social login
router.post("/refresh", refreshToken);                                   // Refresh access token
router.post("/logout", logout);                                          // Logout (clear cookies)


// Email Verification
router.get("/verify-email", verifyEmail);   // Verify email token
router.post("/resend-verification", resendVerification); // Resend verification email

// Password Reset
router.post("/forgot-password", forgotPassword); // Request password reset
router.post("/reset-password", authSchemas.resetPassword, validate, resetPassword);   // Reset password with token

export default router;
