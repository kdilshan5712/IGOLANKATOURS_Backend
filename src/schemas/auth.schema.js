import { body } from 'express-validator';

/**
 * Authentication Validation Schemas
 */
export const authSchemas = {
  /**
   * Validation for Registration
   */
  register: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .isLength({ max: 254 }).withMessage('Email is too long')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
      .matches(/[a-z]/).withMessage('Password must contain lowercase letters')
      .matches(/[A-Z]/).withMessage('Password must contain uppercase letters')
      .matches(/\d/).withMessage('Password must contain numbers')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must contain special characters'),
    
    body('name')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes')
      .custom(value => {
        if (/\d/.test(value)) throw new Error('Full name cannot contain numbers');
        if (value.includes('  ')) throw new Error('Full name cannot contain consecutive spaces');
        return true;
      }),
    
    body('phone')
      .optional({ checkFalsy: true })
      .trim()
      .custom(value => {
        const cleaned = value.replace(/[\s\-\+\(\)]/g, "");
        if (!/^\d+$/.test(cleaned)) throw new Error('Phone number must contain only digits');
        if (cleaned.length < 7 || cleaned.length > 20) throw new Error('Phone number must be 7-20 digits');
        return true;
      }),
    
    body('country')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Country must be 2-100 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('Country can only contain letters, spaces, and hyphens')
  ],

  /**
   * Validation for Login
   */
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),
    body('password')
      .notEmpty().withMessage('Password is required')
  ],

  /**
   * Validation for Password Reset
   */
  resetPassword: [
    body('token')
      .notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
      .matches(/[a-z]/).withMessage('Password must contain lowercase letters')
      .matches(/[A-Z]/).withMessage('Password must contain uppercase letters')
      .matches(/\d/).withMessage('Password must contain numbers')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must contain special characters')
  ]
};
