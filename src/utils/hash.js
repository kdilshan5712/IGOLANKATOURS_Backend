import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password using bcrypt.
 * 
 * @async
 * @function hashPassword
 * @param {string} password - The plain-text password to hash.
 * @returns {Promise<string>} The generated hash.
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * 
 * @async
 * @function comparePassword
 * @param {string} password - The plain-text password to verify.
 * @param {string} hash - The stored hash to compare against.
 * @returns {Promise<boolean>} True if the password matches, false otherwise.
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};
