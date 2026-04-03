import { query, param } from 'express-validator';

/**
 * Package Service Validation Schemas
 */
export const packageSchemas = {
  /**
   * Validation for getting all packages with filters
   */
  getAll: [
    query('category')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(['Cultural', 'Beach', 'Wildlife', 'Adventure', 'Luxury']).withMessage('Invalid category'),
    
    query('budget')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(['budget', 'mid', 'luxury']).withMessage('Invalid budget type'),
    
    query('min_price')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
    
    query('max_price')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Maximum price must be a positive number'),
    
    query('limit')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional({ checkFalsy: true })
      .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
  ],

  /**
   * Validation for calculating package price
   */
  calculatePrice: [
    param('id')
      .notEmpty().withMessage('Package ID is required')
      .isUUID().withMessage('Invalid package ID format'),
    
    query('date')
      .notEmpty().withMessage('Date is required')
      .isISO8601().withMessage('Invalid date format. Use YYYY-MM-DD'),
    
    query('adults')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 50 }).withMessage('Adults must be between 1 and 50'),
    
    query('children')
      .optional({ checkFalsy: true })
      .isInt({ min: 0, max: 50 }).withMessage('Children must be between 0 and 50'),
    
    query('travelers')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 50 }).withMessage('Travelers must be between 1 and 50')
  ]
};
