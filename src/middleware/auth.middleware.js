import { verifyToken } from "../utils/jwt.js";

/**
 * AUTHENTICATION MIDDLEWARE
 * - Verifies JWT
 * - Attaches user payload to req.user
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    // decoded contains: user_id, role, iat, exp
    req.user = {
      user_id: decoded.user_id,
      role: decoded.role
    };

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

/**
 * ROLE-BASED AUTHORIZATION
 * Usage: authorize("admin"), authorize("guide"), authorize("tourist")
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied"
      });
    }
    next();
  };
};
