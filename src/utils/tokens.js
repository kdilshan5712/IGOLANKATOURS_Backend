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
 * Generates a cryptographically secure random token.
 * 
 * @function generateSecureToken
 * @param {number} [bytes=32] - Number of random bytes to generate.
 * @returns {string} Hex-encoded random token.
 */
export const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString("hex");
};

/**
 * Hashes a token using the SHA256 algorithm.
 * Used to securely store a non-reversible version of the token in the database.
 * 
 * @function hashToken
 * @param {string} token - The plain-text token to hash.
 * @returns {string} Hex-encoded SHA256 hash.
 */
export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Generates a new secure token along with its hashed version and an expiration timestamp.
 * 
 * @function generateTokenWithExpiry
 * @param {number} expiryMinutes - The number of minutes until the token expires.
 * @returns {Object} An object containing the plain token, hashed token, and expiresAt date.
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
 * Checks if a given timestamp has already passed, indicating the token is expired.
 * 
 * @function isTokenExpired
 * @param {Date|string} expiresAt - The expiration timestamp to check.
 * @returns {boolean} True if the current time is past the expiration time.
 */
export const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
};

/**
 * Determines if enough time has passed since the last email was sent to allow a resend.
 * 
 * @function canResendEmail
 * @param {Date|string} lastSent - The timestamp when the last email was dispatched.
 * @param {number} [cooldownMinutes=2] - The required waiting period in minutes.
 * @returns {boolean} True if the cooldown period has elapsed.
 */
export const canResendEmail = (lastSent, cooldownMinutes = 2) => {
  if (!lastSent) return true;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const timeSinceLastSent = Date.now() - new Date(lastSent).getTime();
  return timeSinceLastSent >= cooldownMs;
};

/**
 * Calculates the remaining time in seconds until a resend is permitted.
 * 
 * @function getRemainingCooldown
 * @param {Date|string} lastSent - The timestamp when the last email was dispatched.
 * @param {number} [cooldownMinutes=2] - The required waiting period in minutes.
 * @returns {number} The absolute number of seconds remaining in the cooldown.
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
 * Generates a secure token specifically for email verification with the standard 24-hour expiry.
 * 
 * @function generateEmailVerifyToken
 * @returns {Object} An object containing the plain token, hashed token, and expiration date.
 */
export const generateEmailVerifyToken = () => {
  return generateTokenWithExpiry(TOKEN_CONFIG.EMAIL_VERIFY_EXPIRY_MINUTES);
};

/**
 * Generates a secure token specifically for password resets with the standard 1-hour expiry.
 * 
 * @function generatePasswordResetToken
 * @returns {Object} An object containing the plain token, hashed token, and expiration date.
 */
export const generatePasswordResetToken = () => {
  return generateTokenWithExpiry(TOKEN_CONFIG.PASSWORD_RESET_EXPIRY_MINUTES);
};
