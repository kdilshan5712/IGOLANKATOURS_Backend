import db from "../config/db.js";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";

import { hashPassword, comparePassword } from "../utils/hash.js";
import { signToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { emailTemplates } from "../utils/emailTemplates.js";
import { sendEmail, sendWelcomeEmail, sendPasswordReset } from "../utils/emailService.js";
import {
  generateEmailVerifyToken,
  generatePasswordResetToken,
  hashToken,
  isTokenExpired,
  canResendEmail,
  getRemainingCooldown,
  TOKEN_CONFIG
} from "../utils/tokens.js";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
};

/**
 * Registers a new tourist user, validates their data, hashes their password,
 * and sends a verification email.
 * 
 * @async
 * @function registerTourist
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Registration details.
 * @param {string} req.body.email - Valid email address.
 * @param {string} req.body.password - Secure password.
 * @param {string} req.body.full_name - Tourist's full name.
 * @param {string} [req.body.country] - Tourist's country.
 * @param {string} [req.body.phone] - Tourist's phone number.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the user data and JWT.
 */
export const registerTourist = async (req, res) => {
  try {
    const { email, password, full_name, country, phone } = req.body;

    // === COMPREHENSIVE VALIDATION ===
    const errors = {};

    // EMAIL VALIDATION
    if (!email) {
      errors.email = "Email is required";
    } else {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(normalizedEmail)) {
        errors.email = "Invalid email format";
      } else if (normalizedEmail.length > 254) {
        errors.email = "Email is too long (max 254 characters)";
      } else {
        const [localPart, domain] = normalizedEmail.split("@");
        if (localPart.length > 64) {
          errors.email = "Email local part is too long";
        } else if (localPart.startsWith(".") || localPart.endsWith(".")) {
          errors.email = "Email cannot start or end with a dot";
        } else if (localPart.includes("..") || domain.includes("..")) {
          errors.email = "Invalid email format";
        }
      }
    }

    // PASSWORD VALIDATION
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (password.length > 128) {
      errors.password = "Password must not exceed 128 characters";
    } else if (!/[a-z]/.test(password)) {
      errors.password = "Password must contain lowercase letters";
    } else if (!/[A-Z]/.test(password)) {
      errors.password = "Password must contain uppercase letters";
    } else if (!/\d/.test(password)) {
      errors.password = "Password must contain numbers";
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.password = "Password must contain special characters (!@#$%^&*)";
    }

    // FULL NAME VALIDATION (No Numbers)
    if (!full_name) {
      errors.full_name = "Full name is required";
    } else {
      const trimmedName = full_name.trim();
      if (trimmedName.length === 0) {
        errors.full_name = "Full name cannot be empty";
      } else if (trimmedName.length < 2) {
        errors.full_name = "Full name must be at least 2 characters";
      } else if (trimmedName.length > 100) {
        errors.full_name = "Full name must not exceed 100 characters";
      } else if (/\d/.test(trimmedName)) {
        errors.full_name = "Full name cannot contain numbers";
      } else if (!/^[\p{L}\s\-\.']+$/u.test(trimmedName)) {
        errors.full_name = "Full name can only contain letters, spaces, dots, hyphens, and apostrophes";
      } else if (trimmedName.includes("  ")) {
        errors.full_name = "Full name cannot contain consecutive spaces";
      }
    }

    // PHONE VALIDATION (Optional)
    if (phone && phone.trim()) {
      const cleanedPhone = phone.trim().replace(/[\s\-\+\(\)]/g, "");
      if (!/^\d+$/.test(cleanedPhone)) {
        errors.phone = "Phone number must contain only digits";
      } else if (cleanedPhone.length < 7) {
        errors.phone = "Phone number must be at least 7 digits";
      } else if (cleanedPhone.length > 20) {
        errors.phone = "Phone number must not exceed 20 digits";
      }
    }

    // COUNTRY VALIDATION (Optional)
    if (country && country.trim()) {
      const trimmedCountry = country.trim();
      if (trimmedCountry.length < 2) {
        errors.country = "Country name must be at least 2 characters";
      } else if (trimmedCountry.length > 100) {
        errors.country = "Country name must not exceed 100 characters";
      } else if (!/^[a-zA-Z\s\-']+$/.test(trimmedCountry)) {
        errors.country = "Country name can only contain letters, spaces, and hyphens";
      }
    }

    // Return all validation errors at once
    if (Object.keys(errors).length > 0) {
      console.warn("⚠️ [REGISTER] Validation failed:", JSON.stringify(errors));
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existing = await db.query(
      "SELECT user_id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const { token: verifyToken, hashedToken: hashedVerifyToken, expiresAt: verifyExpiresAt } =
      generateEmailVerifyToken();

    console.log("🔐 Generated verification token");
    console.log("   Plain token length:", verifyToken.length);
    console.log("   Hashed token length:", hashedVerifyToken.length);
    console.log("   Expires at:", verifyExpiresAt);

    // Insert user with email_verified = false
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, role, status, email_verified, email_verify_token, email_verify_expires, last_verification_email_sent)
       VALUES ($1, $2, 'tourist', 'active', false, $3, $4, NOW())
       RETURNING user_id, email, role, status, email_verified`,
      [normalizedEmail, passwordHash, hashedVerifyToken, verifyExpiresAt]
    );

    const user = userResult.rows[0];

    // Insert tourist profile
    await db.query(
      `INSERT INTO tourist (user_id, full_name, country, phone)
       VALUES ($1, $2, $3, $4)`,
      [user.user_id, full_name.trim(), country?.trim() || null, phone?.trim() || null]
    );

    const profileResult = await db.query(
      `SELECT full_name, country, phone
       FROM tourist
       WHERE user_id = $1`,
      [user.user_id]
    );

    // JWT
    const token = signToken({
      user_id: user.user_id,
      role: user.role
    });

    const refreshToken = signRefreshToken({
      user_id: user.user_id,
      role: user.role
    });

    setRefreshTokenCookie(res, refreshToken);

    // Generate verification link
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verifyToken}`;

    // Send verification email using new service
    let emailSendingError = null;
    try {
      const verificationEmail = emailTemplates.emailVerification(full_name.trim(), verificationLink);
      const verifyResult = await sendEmail(normalizedEmail, verificationEmail.subject, verificationEmail.html);

      if (!verifyResult || !verifyResult.success) {
        emailSendingError = verifyResult?.error || "Unknown email provider error";
        console.error("❌ Failed to send verification email:", emailSendingError);
      } else {
        // Only send welcome email if verification sent successfully
        const welcomeResult = await sendWelcomeEmail(normalizedEmail, full_name.trim());
        if (!welcomeResult || !welcomeResult.success) {
          console.error("❌ Welcome email failed, but verification was sent.");
        }
      }
    } catch (emailErr) {
      emailSendingError = emailErr.message;
      console.error("❌ Error in email sending block:", emailErr.message);
    }

    if (emailSendingError) {
      // Return 201 because the user WAS created, but provide the email error details.
      return res.status(201).json({
        message: "Registration successful, but we could not send the verification email. Please check your email configuration or contact support.",
        emailError: emailSendingError,
        token,
        user: {
          id: user.user_id,
          email: user.email,
          role: user.role,
          email_verified: user.email_verified,
          full_name: profileResult.rows[0]?.full_name || null,
          name: profileResult.rows[0]?.full_name || null,
          country: profileResult.rows[0]?.country || null,
          phone: profileResult.rows[0]?.phone || null
        }
      });
    }

    res.status(201).json({
      message: "Tourist registered successfully. Please check your email to verify your account.",
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
        full_name: profileResult.rows[0]?.full_name || null,
        name: profileResult.rows[0]?.full_name || null,
        country: profileResult.rows[0]?.country || null,
        phone: profileResult.rows[0]?.phone || null
      }
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Caught exceptions are logged and forwarded to the global error handler
    console.error("Tourist register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};

/**
 * Authenticates a user (admin, tourist, or guide) and issues JWT access and refresh tokens.
 * 
 * @async
 * @function login
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Login credentials.
 * @param {string} req.body.email - Registered email.
 * @param {string} req.body.password - User password.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with access token and user profile.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // === LOGIN VALIDATION ===
    const errors = {};

    // EMAIL VALIDATION
    if (!email) {
      errors.email = "Email is required";
    } else {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        errors.email = "Invalid email format";
      }
    }

    // PASSWORD VALIDATION
    if (!password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    console.log(`🔍 [LOGIN] Attempting login for: ${normalizedEmail}`);

    let result;
    try {
      result = await db.query(
        `SELECT user_id, email, password_hash, role, status, email_verified
         FROM users
         WHERE email = $1`,
        [normalizedEmail]
      );
    } catch (dbErr) {
      console.error("❌ [LOGIN] User lookup query failed:", dbErr.message);
      return res.status(503).json({
        message: "Database service unavailable. Please try again shortly.",
        error: dbErr.message
      });
    }

    if (result.rows.length === 0) {
      console.warn(`⚠️ [LOGIN] User not found: ${normalizedEmail}`);
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const user = result.rows[0];
    console.log(`✅ [LOGIN] User found, role: ${user.role}, status: ${user.status}`);

    /* --------------------------------------------------
       PASSWORD CHECK (FIRST)
       -------------------------------------------------- */
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    /* --------------------------------------------------
       ISSUE JWT (ALL ROLES)
       -------------------------------------------------- */
    const token = signToken({
      user_id: user.user_id,
      role: user.role
    });

    const refreshToken = signRefreshToken({
      user_id: user.user_id,
      role: user.role
    });

    setRefreshTokenCookie(res, refreshToken);

    let profile = null;

    /* --------------------------------------------------
       STRICT ROLE VALIDATION & PROFILE FETCHING
       -------------------------------------------------- */
    if (user.role === "tourist") {
      const profileResult = await db.query(
        `SELECT full_name, country, phone, profile_photo FROM tourist WHERE user_id = $1`,
        [user.user_id]
      );
      if (profileResult.rows.length === 0) {
        return res.status(403).json({
          message: "Invalid account configuration. Tourist profile not found."
        });
      }
      profile = profileResult.rows[0];
    } else if (user.role === "guide") {
      const profileResult = await db.query(
        `SELECT guide_id, full_name, contact_number, profile_photo FROM tour_guide WHERE user_id = $1`,
        [user.user_id]
      );
      if (profileResult.rows.length === 0) {
        return res.status(403).json({
          message: "Invalid account configuration. Tour guide profile not found."
        });
      }
      profile = profileResult.rows[0];
    } else if (user.role === "admin") {
      // Admins might not have a record in the 'admin' table if it's a legacy account
      // so we try to get the photo but don't fail if the table/record is missing
      try {
        const adminResult = await db.query(
          `SELECT profile_photo FROM admin WHERE user_id = $1`,
          [user.user_id]
        );
        profile = {
          full_name: "Administrator",
          profile_photo: adminResult.rows[0]?.profile_photo || null
        };
      } catch (err) {
        console.warn("⚠️ Admin table query failed (optional for login):", err.message);
        profile = { full_name: "Administrator", profile_photo: null };
      }
    } else {
      return res.status(403).json({
        message: "Invalid role configuration"
      });
    }

    /* --------------------------------------------------
       ROLE-BASED STATUS RULES
       -------------------------------------------------- */

    // Allow pending and rejected guides to login (for status tracking and document resubmission)
    const isPending = user.status === "pending";
    const isRejected = user.status === "rejected";

    // Block only if status is something else (e.g., suspended, deleted)
    // and they are not a tourist (tourists are active by default after verification)
    if (user.status !== "active" && !isPending && !isRejected) {
      return res.status(403).json({
        message: `Account is ${user.status}. Please contact support.`
      });
    }

    // Enforce email verification (Admins are exempt as legacy accounts may lack this)
    if (user.role !== "admin" && user.email_verified === false) {
      return res.status(403).json({
        message: "Please verify your email address before logging in.",
        requiresVerification: true
      });
    }

    // Check if a guide has uploaded any documents
    let hasUploadedDocuments = false;
    if (user.role === "guide" && profile.guide_id) {
      const docsRes = await db.query('SELECT 1 FROM guide_documents WHERE guide_id = $1 LIMIT 1', [profile.guide_id]);
      hasUploadedDocuments = docsRes.rows.length > 0;
    }

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
        full_name: profile?.full_name || "User",
        name: profile?.full_name || "User",
        country: profile?.country || null,
        phone: profile?.phone || profile?.contact_number || null,
        profile_photo: profile?.profile_photo || null,
        isPending: isPending,
        isRejected: isRejected,
        canResubmit: isRejected,
        hasUploadedDocuments: hasUploadedDocuments
      }
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Handled by server.js global error handler
    console.error("Login fatal error:", err);
    res.status(500).json({
      message: "Login failed due to a server error"
    });
  }
};

/**
 * Verifies a user's email address using a token sent during registration.
 * 
 * @async
 * @function verifyEmail
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} req.query.token - plain-text verification token.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming verification.
 */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    console.log("🔍 Verify email request - Token:", token ? "provided" : "missing");

    if (!token) {
      return res.status(400).json({
        message: "Verification token required",
        success: false
      });
    }

    // Hash the token to match database
    const hashedToken = hashToken(token);
    console.log("🔐 Hashed token length:", hashedToken.length);

    // Find user with this token
    const result = await db.query(
      `SELECT user_id, email, email_verify_expires, email_verified
       FROM users
       WHERE email_verify_token = $1`,
      [hashedToken]
    );

    console.log("📊 Query result rows:", result.rows.length);

    if (result.rows.length === 0) {
      // Debug: check if any unverified users exist
      const debugResult = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE email_verified = false`
      );
      console.log("🐛 Debug - Unverified users in DB:", debugResult.rows[0].count);

      return res.status(400).json({
        message: "Invalid or expired verification token",
        success: false
      });
    }

    const user = result.rows[0];
    console.log("✅ Found user:", user.email);

    // Check if already verified
    if (user.email_verified) {
      return res.status(200).json({
        message: "Email already verified",
        success: true,
        verified: true
      });
    }

    // Check expiry
    if (isTokenExpired(user.email_verify_expires)) {
      return res.status(400).json({
        message: "Verification token expired. Please request a new one.",
        success: false
      });
    }

    // Verify email and clear token
    await db.query(
      `UPDATE users
       SET email_verified = true,
           email_verify_token = NULL,
           email_verify_expires = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    console.log(`✅ Email verified for user: ${user.email}`);

    res.json({
      message: "Email verified successfully! You can now log in.",
      success: true,
      verified: true
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Logged and sent to client via global error handler
    console.error("Email verification error:", err);
    res.status(500).json({
      message: "Email verification failed",
      success: false
    });
  }
};

/**
 * Resends the verification email to an unverified user, respecting a cooldown period.
 * 
 * @async
 * @function resendVerification
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.email - Registered email.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming email dispatch.
 */
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    const result = await db.query(
      `SELECT u.user_id, u.email, u.email_verified, u.last_verification_email_sent,
              u.email_verify_token, u.email_verify_expires, t.full_name
       FROM users u
       LEFT JOIN tourist t ON u.user_id = t.user_id
       WHERE u.email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({
        message: "Email already verified"
      });
    }

    // Check cooldown
    if (!canResendEmail(user.last_verification_email_sent, TOKEN_CONFIG.RESEND_COOLDOWN_MINUTES)) {
      const remainingSeconds = getRemainingCooldown(
        user.last_verification_email_sent,
        TOKEN_CONFIG.RESEND_COOLDOWN_MINUTES
      );
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting another email`,
        remainingSeconds
      });
    }

    let verifyToken, hashedVerifyToken, verifyExpiresAt;

    // Reuse existing token if not expired
    if (user.email_verify_token && !isTokenExpired(user.email_verify_expires)) {
      console.log("Reusing existing verification token");
      // We can't send the original token (it's hashed), so generate new one
      const newTokenData = generateEmailVerifyToken();
      verifyToken = newTokenData.token;
      hashedVerifyToken = newTokenData.hashedToken;
      verifyExpiresAt = newTokenData.expiresAt;
    } else {
      // Generate new token
      const tokenData = generateEmailVerifyToken();
      verifyToken = tokenData.token;
      hashedVerifyToken = tokenData.hashedToken;
      verifyExpiresAt = tokenData.expiresAt;
    }

    // Update token and timestamp
    await db.query(
      `UPDATE users
       SET email_verify_token = $1,
           email_verify_expires = $2,
           last_verification_email_sent = NOW()
       WHERE user_id = $3`,
      [hashedVerifyToken, verifyExpiresAt, user.user_id]
    );

    // Generate verification link
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verifyToken}`;

    // Send email
    const verificationEmail = emailTemplates.emailVerification(
      user.full_name || 'User',
      verificationLink
    );

    // Send email using emailService to ensure it's logged and uses unified config
    try {
      await sendEmail(normalizedEmail, verificationEmail.subject, verificationEmail.html);
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }

    res.json({
      message: "Verification email sent. Please check your inbox.",
      cooldownSeconds: TOKEN_CONFIG.RESEND_COOLDOWN_MINUTES * 60
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Propagates to server.js
    console.error("Resend verification error:", err);
    res.status(500).json({ message: "Failed to resend verification email" });
  }
};

/**
 * Initiates the password reset process by generating a token and sending an email.
 * 
 * @async
 * @function forgotPassword
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.email - Registered email.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming request processing.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user with full_name from appropriate table
    const result = await db.query(
      `SELECT u.user_id, u.email, u.role, u.last_reset_email_sent,
              COALESCE(t.full_name, tg.full_name, 'User') as full_name
       FROM users u
       LEFT JOIN tourist t ON u.user_id = t.user_id AND u.role = 'tourist'
       LEFT JOIN tour_guide tg ON u.user_id = tg.user_id AND u.role = 'guide'
       WHERE u.email = $1`,
      [normalizedEmail]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({
        message: "If that email exists, a password reset link has been sent."
      });
    }

    const user = result.rows[0];

    // Check cooldown
    if (!canResendEmail(user.last_reset_email_sent, TOKEN_CONFIG.RESEND_COOLDOWN_MINUTES)) {
      const remainingSeconds = getRemainingCooldown(
        user.last_reset_email_sent,
        TOKEN_CONFIG.RESEND_COOLDOWN_MINUTES
      );
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting another reset email`,
        remainingSeconds
      });
    }

    // Generate reset token
    const { token: resetToken, hashedToken: hashedResetToken, expiresAt: resetExpiresAt } =
      generatePasswordResetToken();

    // Update user with reset token
    await db.query(
      `UPDATE users
       SET reset_password_token = $1,
           reset_password_expires = $2,
           last_reset_email_sent = NOW()
       WHERE user_id = $3`,
      [hashedResetToken, resetExpiresAt, user.user_id]
    );

    // Generate reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`;

    // Send email using new service
    try {
      await sendPasswordReset(normalizedEmail, resetToken, user.full_name);
    } catch (emailErr) {
      console.error("Password reset email send failed:", emailErr);
    }

    console.log(`🔐 Password reset requested for: ${user.email}`);

    res.json({
      message: "If that email exists, a password reset link has been sent.",
      expiresInMinutes: TOKEN_CONFIG.PASSWORD_RESET_EXPIRY_MINUTES
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Handled by centralized error middleware
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
};

/**
 * Resets a user's password using a valid reset token.
 * 
 * @async
 * @function resetPassword
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Password reset details.
 * @param {string} req.body.token - plain-text password reset token.
 * @param {string} req.body.newPassword - New secure password.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming password reset.
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // === PASSWORD RESET VALIDATION ===
    const errors = {};

    if (!token) {
      errors.token = "Reset token is required";
    }

    if (!newPassword) {
      errors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters";
    } else if (newPassword.length > 128) {
      errors.newPassword = "Password must not exceed 128 characters";
    } else if (!/[a-z]/.test(newPassword)) {
      errors.newPassword = "Password must contain lowercase letters";
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = "Password must contain uppercase letters";
    } else if (!/\d/.test(newPassword)) {
      errors.newPassword = "Password must contain numbers";
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      errors.newPassword = "Password must contain special characters (!@#$%^&*)";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const hashedToken = hashToken(token.trim());

    // Find user with this token
    const result = await db.query(
      `SELECT user_id, email, reset_password_expires
       FROM users
       WHERE reset_password_token = $1`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid or expired reset token"
      });
    }

    const user = result.rows[0];

    // Check expiry
    if (isTokenExpired(user.reset_password_expires)) {
      return res.status(400).json({
        message: "Reset token has expired. Please request a new one."
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password and clear token
    await db.query(
      `UPDATE users
       SET password_hash = $1,
           reset_password_token = NULL,
           reset_password_expires = NULL,
           last_reset_email_sent = NULL
       WHERE user_id = $2`,
      [newPasswordHash, user.user_id]
    );

    console.log(`✅ Password reset successful for user: ${user.email}`);

    res.json({
      message: "Password reset successful. You can now log in with your new password."
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Password reset failed" });
  }
};

/**
 * Authenticates or registers a user using social identity providers (Google or Facebook).
 * 
 * @async
 * @function socialLogin
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Social login payload.
 * @param {string} req.body.provider - Social provider name ('google' or 'facebook').
 * @param {string} [req.body.credential] - Google Identity Services ID token.
 * @param {string} [req.body.accessToken] - Facebook access token.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with access token and user profile.
 */
let googleClient;

export const socialLogin = async (req, res) => {
  try {
    const { provider, credential, accessToken } = req.body;
    let email, name, providerId, photo;

    if (provider === "google") {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ message: "Google Client ID not configured on server." });
      }
      if (!googleClient) {
        googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      }
      // Verify Google Token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email.toLowerCase();
      name = payload.name;
      providerId = payload.sub;
      photo = payload.picture;
    } else if (provider === "facebook") {
      // Verify Facebook Access Token
      const fbRes = await axios.get(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`);
      const fbData = fbRes.data;
      if (!fbData.email) {
        return res.status(400).json({ message: "Facebook account must have an associated email." });
      }
      email = fbData.email.toLowerCase();
      name = fbData.name;
      providerId = fbData.id;
      photo = fbData.picture?.data?.url;
    } else {
      return res.status(400).json({ message: "Invalid provider" });
    }

    // 1. Check if user exists by provider ID
    let userResult = await db.query(
      `SELECT user_id, email, role, status, email_verified FROM users WHERE ${provider}_id = $1`,
      [providerId]
    );

    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    } else {
      // 2. Check if user exists by email (link accounts)
      userResult = await db.query(
        `SELECT user_id, email, role, status, email_verified, google_id, facebook_id FROM users WHERE email = $1`,
        [email]
      );

      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
        // Link the provider ID to existing account
        await db.query(
          `UPDATE users SET ${provider}_id = $1, email_verified = true WHERE user_id = $2`,
          [providerId, user.user_id]
        );
        user.email_verified = true;
      } else {
        // 3. Create NEW user
        const newUserResult = await db.query(
          `INSERT INTO users (email, role, status, email_verified, ${provider}_id)
           VALUES ($1, 'tourist', 'active', true, $2)
           RETURNING user_id, email, role, status, email_verified`,
          [email, providerId]
        );
        user = newUserResult.rows[0];

        // Create tourist profile
        await db.query(
          `INSERT INTO tourist (user_id, full_name, profile_photo)
           VALUES ($1, $2, $3)`,
          [user.user_id, name, photo]
        );
      }
    }

    // Check account status
    if (user.status !== "active") {
      return res.status(403).json({ message: `Account is ${user.status}. Please contact support.` });
    }

    // Issue JWT
    const token = signToken({
      user_id: user.user_id,
      role: user.role
    });

    const refreshToken = signRefreshToken({
      user_id: user.user_id,
      role: user.role
    });

    setRefreshTokenCookie(res, refreshToken);

    // Fetch full profile for response
    let profile = { full_name: name, profile_photo: photo };
    if (user.role === "tourist") {
        const pRes = await db.query(`SELECT full_name, profile_photo, country, phone FROM tourist WHERE user_id = $1`, [user.user_id]);
        if (pRes.rows.length > 0) profile = pRes.rows[0];
    }

    res.json({
      message: "Social login successful",
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
        full_name: profile.full_name,
        name: profile.full_name,
        profile_photo: profile.profile_photo,
        country: profile.country || null,
        phone: profile.phone || null
      }
    });

  } catch (err) {
    console.error("Social login error:", err);
    res.status(500).json({ message: "Social authentication failed" });
  }
};

/**
 * Issues a new access token using a valid refresh token stored in a HTTP-only cookie.
 * 
 * @async
 * @function refreshToken
 * @param {Object} req - Express request object.
 * @param {Object} req.cookies - Cookies containing the refresh token.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the new access token.
 */
export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    // Optional: Check if user still exists/is active in database
    const userRes = await db.query(
      "SELECT user_id, role, status FROM users WHERE user_id = $1",
      [payload.user_id]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status !== "active") {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ message: "User account is inactive or not found" });
    }

    const { user_id, role } = userRes.rows[0];

    // Issue new access token
    const newAccessToken = signToken({ user_id, role });

    // Optional: Issue a new refresh token (token rotation) for even higher security
    const newRefreshToken = signRefreshToken({ user_id, role });
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      token: newAccessToken
    });

  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ message: "Failed to refresh token" });
  }
};

/**
 * Logs out the user by clearing the refresh token cookie.
 * 
 * @async
 * @function logout
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming logout.
 */
export const logout = async (req, res) => {
  clearRefreshTokenCookie(res);
  res.json({ message: "Logged out successfully" });
};
