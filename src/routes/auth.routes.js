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

const router = express.Router();

// Registration & Login
router.post("/register", registerTourist);  // Tourist registration
router.post("/login", login);               // All roles login

// Email Verification
router.get("/verify-email", verifyEmail);   // Verify email token
router.post("/resend-verification", resendVerification); // Resend verification email

// Password Reset
router.post("/forgot-password", forgotPassword); // Request password reset
router.post("/reset-password", resetPassword);   // Reset password with token

// DEBUG: List unverified users (remove in production)
router.get("/debug/unverified-users", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT email, email_verified, email_verify_token IS NOT NULL as has_token, email_verify_expires 
       FROM users 
       WHERE email_verified = false 
       LIMIT 10`
    );
    res.json({ unverified_users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
