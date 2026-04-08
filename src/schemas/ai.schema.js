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
    body('sessionId')
      .notEmpty().withMessage('Session ID is required')
      .isUUID().withMessage('Session ID must be a valid UUID'),
    
    body('messages')
      .isArray().withMessage('Messages must be an array')
      .notEmpty().withMessage('Messages cannot be empty'),
    
    body('messages.*.sender')
      .isIn(['user', 'assistant', 'system']).withMessage('Invalid message sender'),
    
    body('messages.*.text')
      .notEmpty().withMessage('Message text is required')
      .isString().withMessage('Message text must be a string')
  ]
};
