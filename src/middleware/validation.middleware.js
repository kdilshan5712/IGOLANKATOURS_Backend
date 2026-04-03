import { validationResult } from 'express-validator';

/**
 * Reusable middleware to handle validation results
 * If there are errors, it returns a 400 Bad Request with a structured errors object
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = {};
  errors.array().forEach(err => {
    // Standardize to a flat object where keys are field names and values are messages
    // If multiple errors exist for one field, the last one wins (or we could make it an array)
    extractedErrors[err.path] = err.msg;
  });

  console.warn(`⚠️ [VALIDATION] Failed for ${req.method} ${req.originalUrl}:`, extractedErrors);

  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: extractedErrors
  });
};
