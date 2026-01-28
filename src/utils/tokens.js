import crypto from "crypto";

/**
 * ================================================================
 * TOKEN UTILITY
 * ================================================================
 * Secure token generation and management for email verification
 * and password reset functionality.
 * 
 * SECURITY:
 * - Tokens are generated using crypto.randomBytes (cryptographically secure)
 * - Only hashed tokens (SHA256) are stored in database
 * - Plain tokens are sent via email, never stored
 * - Tokens expire after configured time period
 * ================================================================
 */

/**
 * Generate a secure random token
 * @param {number} bytes - Number of random bytes (default: 32)
 * @returns {string} - Hex-encoded random token
 */
export const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString("hex");
};

/**
 * Hash a token using SHA256
 * Used to store hashed version in database for security
 * @param {string} token - Plain token to hash
 * @returns {string} - Hex-encoded SHA256 hash
 */
export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Generate token with expiry
 * @param {number} expiryMinutes - Token validity in minutes
 * @returns {Object} - { token, hashedToken, expiresAt }
 */
export const generateTokenWithExpiry = (expiryMinutes) => {
  const token = generateSecureToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  return {
    token, // Send this via email
    hashedToken, // Store this in database
    expiresAt // Store this in database
  };
};

/**
 * Verify if a token is expired
 * @param {Date|string} expiresAt - Expiry timestamp
 * @returns {boolean} - True if expired
 */
export const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
};

/**
 * Check if cooldown period has passed
 * @param {Date|string} lastSent - Last email sent timestamp
 * @param {number} cooldownMinutes - Cooldown period in minutes
 * @returns {boolean} - True if cooldown passed
 */
export const canResendEmail = (lastSent, cooldownMinutes = 2) => {
  if (!lastSent) return true;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const timeSinceLastSent = Date.now() - new Date(lastSent).getTime();
  return timeSinceLastSent >= cooldownMs;
};

/**
 * Get remaining cooldown time in seconds
 * @param {Date|string} lastSent - Last email sent timestamp
 * @param {number} cooldownMinutes - Cooldown period in minutes
 * @returns {number} - Remaining seconds (0 if cooldown passed)
 */
export const getRemainingCooldown = (lastSent, cooldownMinutes = 2) => {
  if (!lastSent) return 0;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const timeSinceLastSent = Date.now() - new Date(lastSent).getTime();
  const remainingMs = cooldownMs - timeSinceLastSent;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};

/**
 * Configuration constants
 */
export const TOKEN_CONFIG = {
  EMAIL_VERIFY_EXPIRY_MINUTES: 24 * 60, // 24 hours
  PASSWORD_RESET_EXPIRY_MINUTES: 60, // 1 hour
  RESEND_COOLDOWN_MINUTES: 2, // 2 minutes between resends
  TOKEN_BYTES: 32 // 64 character hex string
};

/**
 * Generate email verification token
 * @returns {Object} - { token, hashedToken, expiresAt }
 */
export const generateEmailVerifyToken = () => {
  return generateTokenWithExpiry(TOKEN_CONFIG.EMAIL_VERIFY_EXPIRY_MINUTES);
};

/**
 * Generate password reset token
 * @returns {Object} - { token, hashedToken, expiresAt }
 */
export const generatePasswordResetToken = () => {
  return generateTokenWithExpiry(TOKEN_CONFIG.PASSWORD_RESET_EXPIRY_MINUTES);
};
