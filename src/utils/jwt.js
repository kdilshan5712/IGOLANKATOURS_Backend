import jwt from "jsonwebtoken";

// Safety check for secrets
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.error("❌ JWT secrets are not fully defined");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

/**
 * Generates a short-lived JSON Web Token (Access Token).
 * 
 * @function signToken
 * @param {Object} payload - The data to encode in the token.
 * @returns {string} The signed JWT.
 */
export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m"
  });
};

/**
 * Verifies the validity of an Access Token.
 * 
 * @function verifyToken
 * @param {string} token - The JWT to verify.
 * @returns {Object} The decoded payload.
 * @throws {Error} If the token is invalid or expired.
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Generates a long-lived JSON Web Token (Refresh Token) for session persistence.
 * 
 * @function signRefreshToken
 * @param {Object} payload - The data to encode in the token.
 * @returns {string} The signed refreshment JWT.
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
  });
};

/**
 * Verifies the validity of a Refresh Token.
 * 
 * @function verifyRefreshToken
 * @param {string} token - The refreshment JWT to verify.
 * @returns {Object} The decoded payload.
 * @throws {Error} If the token is invalid or expired.
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};
