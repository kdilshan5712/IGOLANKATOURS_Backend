import db from "../config/db.js";
import { hashPassword } from "../utils/hash.js";

/**
 * Retrieves the currently authenticated admin's profile statistics.
 * Includes a database timeout fallback to return session-based data if the DB is slow.
 * 
 * @async
 * @function getAdminProfile
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated user object from middleware.
 * @param {string} req.user.user_id - ID of the authenticated admin.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with admin profile details.
 */
export const getAdminProfile = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    // Add timeout for database query
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    const result = await Promise.race([
      db.query(
        `SELECT 
          u.user_id,
          u.email,
          u.role,
          u.created_at,
          u.status,
          u.email_verified,
          a.profile_photo
        FROM users u
        LEFT JOIN admin a ON u.user_id = a.user_id
        WHERE u.user_id = $1 AND u.role = 'admin'`,
        [user_id]
      ),
      timeoutPromise
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Admin profile not found"
      });
    }

    const profile = result.rows[0];
    
    // Admin profile structure
    const adminProfile = {
      user_id: profile.user_id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      email_verified: profile.email_verified,
      created_at: profile.created_at,
      profile_photo: profile.profile_photo || null,
      full_name: "Administrator", // Admins don't have separate profile table
      first_name: "Admin",
      last_name: ""
    };

    return res.json({
      message: "Profile retrieved successfully",
      profile: adminProfile
    });
  } catch (error) {
    console.error("⚠️ Error fetching admin profile:", error.message);
    
    // If database is unavailable, return basic profile from JWT
    if (error.message === 'Database timeout' || error.message.includes('timeout') || error.message.includes('Connection terminated')) {
      console.warn('⚠️ Database unavailable, returning JWT-based profile');
      return res.json({
        message: "Profile retrieved from session (database unavailable)",
        profile: {
          user_id: user_id,
          email: req.user.email || "admin@igolankatours.com",
          role: "admin",
          status: "active",
          email_verified: true,
          created_at: new Date().toISOString(),
          full_name: "Administrator",
          first_name: "Admin",
          last_name: ""
        }
      });
    }
    
    return res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};

/**
 * Allows an existing admin to create a new administrative account.
 * Validates email format, password strength, and ensures email uniqueness.
 * 
 * @async
 * @function createAdmin
 * @param {Object} req - Express request object.
 * @param {Object} req.body - New admin details.
 * @param {string} req.body.email - Email for the new admin account.
 * @param {string} req.body.password - Password for the new account (min 8 chars).
 * @param {string} [req.body.full_name] - Optional full name for the admin.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created admin info.
 */
export const createAdmin = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long"
      });
    }

    // Check if email already exists
    const existingUser = await db.query(
      `SELECT user_id FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, role, status, email_verified)
       VALUES ($1, $2, 'admin', 'active', true)
       RETURNING user_id, email, role, status, created_at`,
      [normalizedEmail, passwordHash]
    );

    const newAdmin = result.rows[0];

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      admin: {
        user_id: newAdmin.user_id,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
        created_at: newAdmin.created_at,
        full_name: full_name || "Administrator"
      }
    });

  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin account",
      error: error.message
    });
  }
};

/**
 * Lists all registered administrative accounts in the system.
 * 
 * @async
 * @function getAllAdmins
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of all admins.
 */
export const getAllAdmins = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        user_id,
        email,
        role,
        status,
        email_verified,
        created_at
      FROM users 
      WHERE role = 'admin'
      ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      count: result.rows.length,
      admins: result.rows
    });

  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin accounts"
    });
  }
};

