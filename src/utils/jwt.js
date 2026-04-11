import jwt from "jsonwebtoken";

// Safety check for secrets
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.error("❌ JWT secrets are not fully defined");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

/**
 * Sign an Access Token (short-lived)
 */
export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m"
  });
};

/**
 * Verify an Access Token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Sign a Refresh Token (long-lived)
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
  });
};

/**
 * Verify a Refresh Token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};
