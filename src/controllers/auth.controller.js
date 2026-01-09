import db from "../config/db.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { signToken } from "../utils/jwt.js";

/* ======================================================
   TOURIST REGISTER
   POST /api/auth/register
   ====================================================== */
export const registerTourist = async (req, res) => {
  try {
    const { email, password, full_name, country, phone } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Check existing user
    const existing = await db.query(
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, role, status)
       VALUES ($1, $2, 'tourist', 'active')
       RETURNING user_id, email, role`,
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    // Insert tourist profile
    await db.query(
      `INSERT INTO tourist (user_id, full_name, country, phone)
       VALUES ($1, $2, $3, $4)`,
      [user.user_id, full_name, country || null, phone || null]
    );

    // Create JWT
    const token = signToken({
      user_id: user.user_id,
      role: user.role
    });

    res.status(201).json({
      message: "Tourist registered successfully",
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Tourist register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};

/* ======================================================
   LOGIN (ALL ROLES – TOURIST USED HERE)
   POST /api/auth/login
   ====================================================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const result = await db.query(
      `SELECT user_id, email, password_hash, role, status
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Account not active"
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({
      user_id: user.user_id,
      role: user.role
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
};
