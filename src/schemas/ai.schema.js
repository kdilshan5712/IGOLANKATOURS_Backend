import { body } from 'express-validator';

/**
 * AI Service Validation Schemas
 */
export const aiSchemas = {
  /**
   * Validation for saving a chatbot session
   */
  saveSession: [
    body('session_id')
      .notEmpty().withMessage('Session ID is required')
      .isUUID().withMessage('Session ID must be a valid UUID'),
    
    body('user_message')
      .trim()
      .notEmpty().withMessage('User message is required')
      .isLength({ max: 5000 }).withMessage('User message is too long'),
    
    body('ai_response')
      .trim()
      .notEmpty().withMessage('AI response is required')
      .isLength({ max: 10000 }).withMessage('AI response is too long'),
    
    body('tour_package_id')
      .optional({ checkFalsy: true })
      .isUUID().withMessage('Package ID must be a valid UUID')
  ],

  /**
   * Validation for syncing chat history
   */
  syncHistory: [
    body('session_id')
      .notEmpty().withMessage('Session ID is required')
      .isUUID().withMessage('Session ID must be a valid UUID'),
    
    body('history')
      .isArray().withMessage('History must be an array')
      .notEmpty().withMessage('History cannot be empty'),
    
    body('history.*.role')
      .isIn(['user', 'assistant', 'system']).withMessage('Invalid message role'),
    
    body('history.*.content')
      .notEmpty().withMessage('Message content is required')
      .isString().withMessage('Message content must be a string')
  ]
};
