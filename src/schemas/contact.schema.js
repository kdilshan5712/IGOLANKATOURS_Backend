import { body } from 'express-validator';

/**
 * Contact and AI Custom Tour Validation Schemas
 */
export const contactSchemas = {
  /**
   * Validation for Public Contact Form
   */
  submit: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),
    
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isLength({ min: 3 }).withMessage('Subject must be at least 3 characters'),
    
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
  ],

  /**
   * Validation for Custom Tour Request
   */
  customTour: [
    body('title')
      .trim()
      .notEmpty().withMessage('Tour title is required'),
      
    body('duration_days')
      .isInt({ min: 1, max: 30 }).withMessage('Duration must be between 1 and 30 days'),
      
    body('travel_month')
      .notEmpty().withMessage('Travel month is required'),
      
    body('traveler_count')
      .isInt({ min: 1 }).withMessage('At least 1 traveler is required'),
      
    body('tourist_email')
      .trim()
      .notEmpty().withMessage('Contact email is required')
      .isEmail().withMessage('Invalid email format'),
      
    body('tourist_name')
      .trim()
      .notEmpty().withMessage('Contact name is required')
  ]
};
