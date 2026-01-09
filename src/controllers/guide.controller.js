import supabase from "../config/supabase.js";
import db from "../config/db.js";
import { hashPassword } from "../utils/hash.js";
import { signToken } from "../utils/jwt.js";

/* ======================================================
   REGISTER GUIDE
   ====================================================== */
export const registerGuide = async (req, res) => {
  try {
    const { email, password, full_name, contact_number } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await db.query(
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await hashPassword(password);

    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, role, status)
       VALUES ($1, $2, 'guide', 'pending')
       RETURNING user_id`,
      [email, passwordHash]
    );

    const userId = userRes.rows[0].user_id;

    await db.query(
      `INSERT INTO tour_guide (user_id, full_name, contact_number, approved)
       VALUES ($1, $2, $3, false)`,
      [userId, full_name, contact_number || null]
    );

    const token = signToken({ user_id: userId, role: "guide" });

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

    console.log("📦 File received:", file);
    console.log("📄 Document type:", document_type);

    if (!file || !document_type) {
      return res.status(400).json({
        message: "Document file and document_type are required"
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
      return res.status(403).json({
        message: "Guide profile not found"
      });
    }

    const guide = guideRes.rows[0];

    if (guide.approved) {
      return res.status(400).json({
        message: "Guide already approved"
      });
    }

    /* ---------- PREVENT DUPLICATE DOC ---------- */
    const existingDoc = await db.query(
      `SELECT document_id
       FROM guide_document
       WHERE guide_id = $1 AND document_type = $2`,
      [guide.guide_id, document_type]
    );

    if (existingDoc.rows.length > 0) {
      return res.status(409).json({
        message: `Document '${document_type}' already uploaded`
      });
    }

    /* ---------- UPLOAD TO SUPABASE ---------- */
    const filePath = `guide_${guide.guide_id}/${Date.now()}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("guide-documents")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);
      return res.status(500).json({
        message: "Supabase upload failed",
        error: error.message
      });
    }

    console.log("✅ Uploaded to Supabase:", data);

    /* ---------- SAVE TO DATABASE ---------- */
    await db.query(
      `INSERT INTO guide_document (guide_id, document_type, document_url, verified)
       VALUES ($1, $2, $3, false)`,
      [guide.guide_id, document_type, filePath]
    );

    res.status(201).json({
      message: "Document uploaded successfully. Awaiting admin verification.",
      document: {
        document_type,
        status: "pending"
      }
    });

  } catch (err) {
    console.error("🔥 REAL Upload error:", err);

    res.status(500).json({
      message: "Upload failed",
      error: err.message || err
    });
  }
};
