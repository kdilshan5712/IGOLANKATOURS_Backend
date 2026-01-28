import supabase from "../config/supabase.js";
import db from "../config/db.js";
import { hashPassword } from "../utils/hash.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";

/* ======================================================
   REGISTER GUIDE
   ====================================================== */
export const registerGuide = async (req, res) => {
  try {
    const { email, password, full_name, contact_number } = req.body;

    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Trim and normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters long" 
      });
    }

    // Validate full_name (non-empty after trim)
    if (!full_name.trim()) {
      return res.status(400).json({ message: "Full name cannot be empty" });
    }

    // Check existing user
    const exists = await db.query(
      "SELECT user_id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await hashPassword(password);

    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, role, status)
       VALUES ($1, $2, 'guide', 'pending')
       RETURNING user_id`,
      [normalizedEmail, passwordHash]
    );

    const userId = userRes.rows[0].user_id;

    await db.query(
      `INSERT INTO tour_guide (user_id, full_name, contact_number, approved)
       VALUES ($1, $2, $3, false)`,
      [userId, full_name.trim(), contact_number?.trim() || null]
    );

    const token = signToken({ user_id: userId, role: "guide" });

    // Send registration confirmation email (async, non-blocking)
    const registrationEmail = emailTemplates.guideRegistration(full_name.trim());
    sendEmail(normalizedEmail, registrationEmail.subject, registrationEmail.html)
      .catch(err => console.error("Email send failed:", err));

    res.status(201).json({
      message: "Guide registered. Upload documents to continue.",
      token
    });

  } catch (err) {
    console.error("❌ Guide register error:", err);
    res.status(500).json({ message: "Guide registration failed" });
  }
};

/* ======================================================
   UPLOAD GUIDE DOCUMENTS
   ====================================================== */
export const uploadGuideDocuments = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { document_type } = req.body;
    const file = req.file;

    // Validate required fields
    if (!file) {
      return res.status(400).json({
        message: "Document file is required"
      });
    }

    if (!document_type) {
      return res.status(400).json({
        message: "Document type is required"
      });
    }

    // Validate document_type (allowed values)
    const allowedTypes = ["license", "certificate", "id_card", "other"];
    const normalizedType = document_type.trim().toLowerCase();
    
    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        message: `Invalid document type. Allowed: ${allowedTypes.join(", ")}`
      });
    }

    /* ---------- CHECK GUIDE ---------- */
    const guideRes = await db.query(
      `SELECT guide_id, approved
       FROM tour_guide
       WHERE user_id = $1`,
      [userId]
    );

    if (guideRes.rows.length === 0) {
      return res.status(404).json({
        message: "Guide profile not found"
      });
    }

    const guide = guideRes.rows[0];

    if (guide.approved) {
      return res.status(400).json({
        message: "Guide already approved. Document upload not allowed."
      });
    }

    /* ---------- PREVENT DUPLICATE DOC ---------- */
    const existingDoc = await db.query(
      `SELECT document_id
       FROM guide_document
       WHERE guide_id = $1 AND document_type = $2`,
      [guide.guide_id, normalizedType]
    );

    if (existingDoc.rows.length > 0) {
      return res.status(409).json({
        message: `Document type '${normalizedType}' already uploaded. Please use a different type.`
      });
    }

    /* ---------- UPLOAD TO SUPABASE ---------- */
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `guide_${guide.guide_id}/${Date.now()}_${sanitizedFilename}`;

    const { data, error } = await supabase.storage
      .from("guide-documents")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);
      return res.status(500).json({
        message: "File storage failed. Please try again."
      });
    }

    console.log("✅ Uploaded to Supabase:", data);

    /* ---------- SAVE TO DATABASE ---------- */
    await db.query(
      `INSERT INTO guide_document (guide_id, document_type, document_url, verified)
       VALUES ($1, $2, $3, false)`,
      [guide.guide_id, normalizedType, filePath]
    );

    // Get guide email for notification
    const guideEmailResult = await db.query(
      `SELECT u.email, tg.full_name
       FROM users u
       JOIN tour_guide tg ON u.user_id = tg.user_id
       WHERE tg.guide_id = $1`,
      [guide.guide_id]
    );

    if (guideEmailResult.rows.length > 0) {
      const { email, full_name } = guideEmailResult.rows[0];
      const documentEmail = emailTemplates.guideDocumentUpload(full_name, normalizedType);
      sendEmail(email, documentEmail.subject, documentEmail.html)
        .catch(err => console.error("Email send failed:", err));
    }

    res.status(201).json({
      message: "Document uploaded successfully. Awaiting admin verification.",
      document: {
        document_type: normalizedType,
        document_url: filePath,
        verified: false
      }
    });
  } catch (err) {
    console.error("❌ Guide uploadDocuments error:", err);
    res.status(500).json({ message: "Document upload failed" });
  }
};

/* ======================================================
   GET GUIDE PROFILE
   GET /api/guides/me
   ====================================================== */
export const getGuideProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide profile with status
    const result = await db.query(
      `SELECT 
         tg.guide_id,
         tg.full_name,
         tg.contact_number,
         tg.approved,
         u.email,
         u.status,
         u.email_verified
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Guide profile not found" });
    }

    const guide = result.rows[0];

    // Get uploaded documents
    const docsResult = await db.query(
      `SELECT 
         document_id,
         document_type,
         document_url,
         verified,
         uploaded_at
       FROM guide_document
       WHERE guide_id = $1
       ORDER BY uploaded_at DESC`,
      [guide.guide_id]
    );

    res.json({
      guide_id: guide.guide_id,
      full_name: guide.full_name,
      contact_number: guide.contact_number,
      email: guide.email,
      approved: guide.approved,
      status: guide.status,
      email_verified: guide.email_verified,
      documents: docsResult.rows
    });
  } catch (err) {
    console.error("❌ getGuideProfile error:", err);
    res.status(500).json({ message: "Failed to fetch guide profile" });
  }
};

/* ======================================================
   GUIDE DASHBOARD
   GET /api/guides/dashboard
   ====================================================== */
export const getGuideDashboard = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide info
    const guideResult = await db.query(
      `SELECT 
         tg.guide_id,
         tg.full_name,
         tg.approved,
         u.status
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ message: "Guide profile not found" });
    }

    const guide = guideResult.rows[0];

    // Ensure guide is active
    if (guide.status !== 'active') {
      return res.status(403).json({ 
        message: "Dashboard access restricted. Account not active.",
        status: guide.status
      });
    }

    // Get statistics (placeholder - extend as needed)
    const statsResult = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE verified = true) as verified_docs,
         COUNT(*) FILTER (WHERE verified = false) as pending_docs
       FROM guide_document
       WHERE guide_id = $1`,
      [guide.guide_id]
    );

    const stats = statsResult.rows[0] || { verified_docs: 0, pending_docs: 0 };

    res.json({
      message: "Dashboard access granted",
      guide: {
        guide_id: guide.guide_id,
        full_name: guide.full_name,
        approved: guide.approved,
        status: guide.status
      },
      stats: {
        verified_documents: parseInt(stats.verified_docs),
        pending_documents: parseInt(stats.pending_docs)
      }
    });
  } catch (err) {
    console.error("❌ getGuideDashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
        status: "pending"
      }
    });

  } catch (err) {
    console.error("❌ Upload error:", err);

    res.status(500).json({
      message: "Document upload failed"
    });
  }
};
