import { body, param, query } from 'express-validator';

/**
 * Administrative Management Validation Schemas
 * 
 * Defines strict validation rules for system configuration and content management.
 * @namespace managementSchemas
 */
export const managementSchemas = {
  
  // @VALIDATION_RULE: Destinations Management
  destinations: {
    create: [
      body('name')
        .trim()
        .notEmpty().withMessage('Location name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
      
      body('category')
        .trim()
        .notEmpty().withMessage('Category is required')
        .isIn(['Beach', 'Nature', 'City', 'Heritage', 'Wildlife']).withMessage('Invalid destination category'),
      
      body('description')
        .trim()
        .notEmpty().withMessage('Description is required')
        .isLength({ min: 20, max: 2000 }).withMessage('Description must be 20-2000 characters'),
      
      body('image_url')
        .trim()
        .notEmpty().withMessage('Image URL is required')
        .isURL().withMessage('Must be a valid image URL')
    ],
    update: [
      param('id').isUUID().withMessage('Invalid Destination ID format'),
      body('name').optional().trim().isLength({ min: 2 }),
      body('category').optional().isIn(['Beach', 'Nature', 'City', 'Heritage', 'Wildlife']),
      body('image_url').optional().isURL()
    ]
  },

  // @VALIDATION_RULE: FAQ Management
  faqs: {
    create: [
      body('category')
        .trim()
        .notEmpty().withMessage('Category is required'),
      body('question')
        .trim()
        .notEmpty().withMessage('Question is required')
        .isLength({ min: 10, max: 500 }).withMessage('Question must be 10-500 characters'),
      body('answer')
        .trim()
        .notEmpty().withMessage('Answer is required')
        .isLength({ min: 10, max: 2000 }).withMessage('Answer must be 10-2000 characters')
    ],
    update: [
      param('id').isInt().withMessage('Invalid FAQ ID'),
      body('is_active').optional().isBoolean().withMessage('Status must be boolean')
    ]
  },

  // @VALIDATION_RULE: Pricing Rules Management
  pricing: {
    create: [
      body('name').trim().notEmpty().withMessage('Rule name is required'),
      body('start_month').isInt({ min: 1, max: 12 }),
      body('start_day').isInt({ min: 1, max: 31 }),
      body('end_month').isInt({ min: 1, max: 12 }),
      body('end_day').isInt({ min: 1, max: 31 }),
      body('percentage').isFloat({ min: -100, max: 1000 }).withMessage('Invalid percentage value'),
      body('coast_type').optional().isIn(['south', 'east', 'all'])
    ],
    update: [
      param('id').isInt().withMessage('Invalid Rule ID')
    ]
  },

  // @VALIDATION_RULE: Coupon Management
  coupons: {
    // Used for POST /admin/coupons (create)
    create: [
      body('code')
        .trim()
        .notEmpty().withMessage('Coupon code is required')
        // Allow letters, numbers, hyphens, and underscores (e.g. SUMMER-25, VIP_2026)
        .matches(/^[A-Z0-9_-]+$/i).withMessage('Code must contain only letters, numbers, hyphens, or underscores')
        .isLength({ min: 3, max: 20 }).withMessage('Code must be 3-20 characters'),

      body('discount_type')
        .isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),

      body('discount_value')
        .isFloat({ min: 0.01 }).withMessage('Discount value must be a positive number'),

      body('expiry_date')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Invalid date format')
        .custom((value) => {
          if (new Date(value) <= new Date()) {
            throw new Error('Expiry date must be in the future');
          }
          return true;
        })
    ],

    // Used for PUT /admin/coupons/:id (update) — only editable fields validated
    update: [
      body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean'),

      body('expiry_date')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Invalid date format'),

      body('usage_limit')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),

      body('min_amount')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 }).withMessage('Min amount must be 0 or more'),

      body('max_discount')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 }).withMessage('Max discount must be 0 or more')
    ]
  }
};
