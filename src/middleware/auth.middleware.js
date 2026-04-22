import { verifyToken } from "../utils/jwt.js";
import db from "../config/db.js";

/**
 * Authentication Middleware
 * Validates the presence and integrity of a Bearer JWT in the request headers.
 * If valid, decodes the payload and attaches it to the 'req.user' object for downstream access.
 * 
 * @function authenticate
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void}
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log("🔐 Auth middleware - Path:", req.path);
  console.log("🔐 Auth header:", authHeader ? "present" : "missing");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Provide Bearer token."
    });
  }

  try {
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token is missing"
      });
    }

    const decoded = verifyToken(token);
    console.log("🔐 Token decoded - User:", decoded.user_id, "Role:", decoded.role);

    // Validate decoded payload has required fields
    if (!decoded.user_id || !decoded.role) {
      return res.status(401).json({
        message: "Invalid token payload"
      });
    }

    // decoded contains: user_id, role, iat, exp
    req.user = {
      user_id: decoded.user_id,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error("🔐 Auth error:", err.message);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token has expired"
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token"
      });
    }
    return res.status(401).json({
      message: "Authentication failed"
    });
  }
};

/**
 * Role-Based Authorization Middleware (with strict Database Validation)
 * usage: authorize("admin"), authorize("guide"), authorize("tourist")
 * 
 * Performs a deep validation by:
 * 1. Checking if the user's role (from JWT) is included in the allowed roles.
 * 2. Verifying the role directly against the 'users' table in the database.
 * 3. Ensuring a valid profile exists in the corresponding functional table (tourist/tour_guide/admin).
 * 4. Confirming the account status is 'active' (or allowed transitory states).
 * 
 * Includes a mandatory database timeout to ensure security and prevent hangs during DB instability.
 * 
 * @function authorize
 * @param {...string} allowedRoles - Variable number of role strings that are permitted to access the route.
 * @returns {Function} An asynchronous Express middleware function.
 */
export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    // Check if user's role from JWT is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${req.user.role}`
      });
    }

    try {
      // Add timeout for database query - increased to 15s for better resilience against DB instability/cold starts
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 15000)
      );

      // Verify role and profile existence in a SINGLE query for performance and reliability
      let query;
      let params = [req.user.user_id];

      if (req.user.role === "tourist") {
        query = `
          SELECT u.role, u.status, t.user_id as profile_id 
          FROM users u 
          LEFT JOIN tourist t ON u.user_id = t.user_id 
          WHERE u.user_id = $1`;
      } else if (req.user.role === "guide") {
        query = `
          SELECT u.role, u.status, g.user_id as profile_id 
          FROM users u 
          LEFT JOIN tour_guide g ON u.user_id = g.user_id 
          WHERE u.user_id = $1`;
      } else if (req.user.role === "admin") {
        query = `
          SELECT u.role, u.status, a.user_id as profile_id 
          FROM users u 
          LEFT JOIN admin a ON u.user_id = a.user_id 
          WHERE u.user_id = $1`;
      } else {
        query = `SELECT role, status FROM users WHERE user_id = $1`;
      }

      const userResult = await Promise.race([
        db.query(query, params),
        timeoutPromise
      ]);

      if (userResult.rows.length === 0) {
        return res.status(403).json({
          message: "User account not found"
        });
      }

      const dbUser = userResult.rows[0];

      // Verify role in database matches JWT role
      if (dbUser.role !== req.user.role) {
        console.warn(`🔐 Role mismatch: JWT(${req.user.role}) vs DB(${dbUser.role})`);
        return res.status(403).json({
          message: "Role mismatch detected. Please log in again."
        });
      }

      // Verify user account is active - allow pending/rejected users for profile/status access
      if (dbUser.status !== "active" && dbUser.status !== "pending" && dbUser.status !== "rejected") {
        return res.status(403).json({
          message: `Account is ${dbUser.status}. Please contact support.`
        });
      }

      // Verify profile existence (except for custom roles that might not need one)
      // Note: for admin, we're more lenient as some might be legacy
      const profileRequired = ["tourist", "guide"].includes(req.user.role);
      if (profileRequired && !dbUser.profile_id) {
        return res.status(403).json({
          message: `Invalid account configuration. ${req.user.role} profile not found.`
        });
      }

      next();
    } catch (err) {
      console.error("⚠️ Authorization error:", err.message);

      if (err.message === 'Database timeout' || err.message.includes('timeout') || err.message.includes('Connection terminated')) {
        // Security: do NOT fall back to JWT-only. Reject with 503 so users retry.
        return res.status(503).json({
          message: "Authorization service temporarily unavailable. Please try again in a moment.",
          error: "DB_TIMEOUT"
        });
      }

      return res.status(500).json({
        message: "Authorization validation failed",
        error: err.message
      });
    }
  };
};
