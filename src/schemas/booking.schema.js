/**
 * Tour Booking Validation Schemas
 * 
 * Defines express-validator rules for the tour booking lifecycle, 
 * enforcing future-dated travel requirements, room type integrity, 
 * and detailed traveller profile validation.
 * 
 * @namespace bookingSchemas
 */
export const bookingSchemas = {
  /**
   * Validation for Creating and Updating Bookings
   */
  // @VALIDATION_RULE: Tour Booking Creation
  create: [
    body('package_id')
      .notEmpty().withMessage('Package ID is required')
      .isUUID().withMessage('Invalid Package ID'),
    
    body('travel_date')
      .notEmpty().withMessage('Travel date is required')
      .isISO8601().withMessage('Invalid date format')
      .custom(value => {
        const travelDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (travelDate < today) throw new Error('Travel date must be in the future');
        return true;
      }),
    
    body('adults')
      .optional()
      .isInt({ min: 1 }).withMessage('At least 1 adult is required'),
    
    body('children')
      .optional()
      .isInt({ min: 0 }).withMessage('Children count must be 0 or more'),
    
    body('room_type')
      .optional()
      .isIn(['single', 'double', 'triple', 'family']).withMessage('Invalid room type'),
    
    body('travellers')
      .isArray({ min: 1 }).withMessage('Traveller details are required')
      .custom((value, { req }) => {
        const adults = parseInt(req.body.adults || 0);
        const children = parseInt(req.body.children || 0);
        if (value.length !== (adults + children)) {
          throw new Error(`Traveller count mismatch. Expected ${adults + children} profiles.`);
        }
        return true;
      }),
    
    body('travellers.*.full_name')
      .trim()
      .notEmpty().withMessage('Traveller name is required')
      .isLength({ min: 2 }).withMessage('Traveller name must be at least 2 characters'),
      
    body('travellers.*.passport_number')
      .optional({ checkFalsy: true })
      .trim()
      .isAlphanumeric().withMessage('Passport number must be alphanumeric')
  ]
};
