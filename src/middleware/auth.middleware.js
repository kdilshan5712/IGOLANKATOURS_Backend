import { verifyToken } from "../utils/jwt.js";
import db from "../config/db.js";

/**
 * AUTHENTICATION MIDDLEWARE
 * - Verifies JWT
 * - Attaches user payload to req.user
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
 * ROLE-BASED AUTHORIZATION WITH DATABASE VALIDATION
 * Usage: authorize("admin"), authorize("guide"), authorize("tourist")
 * Can also use multiple roles: authorize("admin", "guide")
 * 
 * This middleware validates that:
 * 1. User has the required role in their JWT
 * 2. User's role in database matches JWT role
 * 3. User has a valid profile in the corresponding role table
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
      // Verify role in database matches JWT and profile exists
      const userResult = await db.query(
        `SELECT role, status FROM users WHERE user_id = $1`,
        [req.user.user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(403).json({
          message: "User account not found"
        });
      }

      const dbUser = userResult.rows[0];

      // Verify role in database matches JWT role
      if (dbUser.role !== req.user.role) {
        return res.status(403).json({
          message: "Role mismatch detected. Please log in again."
        });
      }

      // Verify user account is active
      if (dbUser.status !== "active") {
        return res.status(403).json({
          message: "Account is not active"
        });
      }

      // Verify profile exists in corresponding role table
      let profileExists = false;

      if (req.user.role === "tourist") {
        const profileCheck = await db.query(
          `SELECT user_id FROM tourist WHERE user_id = $1`,
          [req.user.user_id]
        );
        profileExists = profileCheck.rows.length > 0;
      } else if (req.user.role === "guide") {
        const profileCheck = await db.query(
          `SELECT user_id FROM tour_guide WHERE user_id = $1`,
          [req.user.user_id]
        );
        profileExists = profileCheck.rows.length > 0;
      } else if (req.user.role === "admin") {
        const profileCheck = await db.query(
          `SELECT user_id FROM admin WHERE user_id = $1`,
          [req.user.user_id]
        );
        profileExists = profileCheck.rows.length > 0;
      }

      if (!profileExists) {
        return res.status(403).json({
          message: "Invalid account configuration. Profile not found."
        });
      }

      next();
    } catch (err) {
      console.error("Authorization error:", err);
      return res.status(500).json({
        message: "Authorization validation failed"
      });
    }
  };
};
