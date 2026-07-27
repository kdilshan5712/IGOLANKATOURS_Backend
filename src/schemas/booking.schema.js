import { body, param, query } from 'express-validator';

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
      .trim()
      .notEmpty().withMessage('Passport number is required')
      .isAlphanumeric().withMessage('Passport number must be alphanumeric'),

    body('travellers.*.passport_expiry')
      .notEmpty().withMessage('Passport expiry date is required')
      .isISO8601().withMessage('Invalid passport expiry date format')
      .custom((value, { req }) => {
        const travelDate = new Date(req.body.travel_date);
        const passportExpiry = new Date(value);
        const minExpiry = new Date(travelDate);
        minExpiry.setMonth(minExpiry.getMonth() + 6);
        if (passportExpiry < minExpiry) {
          throw new Error('Passport must be valid for at least 6 months after travel date');
        }
        return true;
      }),

    body('travellers.*.nationality')
      .trim()
      .notEmpty().withMessage('Nationality is required'),

    body('travellers.*.date_of_birth')
      .notEmpty().withMessage('Date of birth is required')
      .isISO8601().withMessage('Invalid date of birth format')
      .custom((value, { req, path }) => {
        const travelDate = new Date(req.body.travel_date);
        const dob = new Date(value);
        
        let age = travelDate.getFullYear() - dob.getFullYear();
        const monthDiff = travelDate.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && travelDate.getDate() < dob.getDate())) {
          age--;
        }
        
        const index = parseInt(path.match(/\d+/)[0]);
        const adults = parseInt(req.body.adults || 0);
        const traveler = req.body.travellers[index];
        const type = (traveler?.type || (index < adults ? 'adult' : 'child')).toLowerCase();
        
        if (type === 'adult' || type === 'adults') {
          if (age < 18) {
            throw new Error(`Traveller ${index + 1} is listed as an Adult but is ${age} years old (must be 18 or older on travel date)`);
          }
        } else {
          if (age >= 18) {
            throw new Error(`Traveller ${index + 1} is listed as a Child but is ${age} years old (must be under 18 on travel date)`);
          }
          if (age < 2) {
            throw new Error(`Traveller ${index + 1} is listed as a Child but is ${age} years old (must be 2 or older on travel date)`);
          }
        }
        return true;
      })
  ]
};

