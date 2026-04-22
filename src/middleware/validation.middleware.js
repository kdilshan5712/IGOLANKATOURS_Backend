import { validationResult } from 'express-validator';

// @VALIDATION_CHECK: Shared Validation Result Interceptor
/**
 * Global Validation Result Handler Middleware
 * 
 * Intercepts the request after express-validator rules have run.
 * If validation errors exist, it halts the request and returns a structured 400 Bad Request response.
 * Otherwise, it passes control to the next middleware.
 * 
 * @function validate
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {Object|void} Returns a 400 JSON response if errors exist, otherwise calls next().
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = {};
  errors.array().forEach(err => {
    // Standardize to a flat object where keys are field names and values are messages
    extractedErrors[err.path] = err.msg;
  });

  console.warn(`⚠️ [VALIDATION_FAILURE] ${req.method} ${req.originalUrl}:`, extractedErrors);

  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: extractedErrors
  });
};
