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
       VALUES ($1, $2, 'guide', 'active')
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
  console.log("\n================================================");
  console.log("=== DOCUMENT UPLOAD REQUEST RECEIVED ===");
  console.log("================================================\n");
  
  // Immediate validation of imports
  if (!supabase) {
    console.error("❌ CRITICAL: supabase is undefined!");
    return res.status(500).json({ message: "Storage service not configured" });
  }
  if (!db) {
    console.error("❌ CRITICAL: db is undefined!");
    return res.status(500).json({ message: "Database service not configured" });
  }
  
  try {
    console.log("📥 Request details:", {
      user_exists: !!req.user,
      user_id: req.user?.user_id,
      has_file: !!req.file,
      has_body: !!req.body,
      document_type: req.body?.document_type,
      body_keys: Object.keys(req.body || {}),
      file_details: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer_exists: !!req.file.buffer,
        buffer_length: req.file.buffer?.length
      } : 'NO FILE'
    });

    const userId = req.user.user_id;
    const { document_type } = req.body;
    const file = req.file;

    // Validate required fields
    if (!file) {
      console.error("❌ No file in request");
      return res.status(400).json({
        message: "Document file is required. Please select a file to upload."
      });
    }

    if (!document_type) {
      console.error("❌ No document_type in request");
      return res.status(400).json({
        message: "Document type is required. Please specify: license, certificate, id_card, or other"
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

    console.log("✅ Validation passed");

    /* ---------- CHECK GUIDE ---------- */
    console.log("🔍 Checking guide profile...");
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
    console.log("✅ Guide found:", { guide_id: guide.guide_id, approved: guide.approved });

    if (guide.approved) {
      return res.status(400).json({
        message: "Guide already approved. Document upload not allowed."
      });
    }

    /* ---------- PREVENT DUPLICATE DOC ---------- */
    console.log("🔍 Checking for duplicate documents...");
    const existingDoc = await db.query(
      `SELECT document_id
       FROM guide_documents
       WHERE guide_id = $1 AND document_type = $2`,
      [guide.guide_id, normalizedType]
    );

    if (existingDoc.rows.length > 0) {
      return res.status(409).json({
        message: `Document type '${normalizedType}' already uploaded. Please use a different type.`
      });
    }

    console.log("✅ No duplicate documents");

    /* ---------- UPLOAD TO SUPABASE ---------- */
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `guide_${guide.guide_id}/${Date.now()}_${sanitizedFilename}`;

    console.log("📤 Uploading to Supabase:", {
      bucket: "guide-documents",
      path: filePath,
      size: file.size,
      type: file.mimetype,
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer?.length
    });

    // Ensure buffer exists
    if (!file.buffer || file.buffer.length === 0) {
      console.error("❌ File buffer is empty");
      return res.status(400).json({
        message: "File upload failed: empty file buffer"
      });
    }

    let uploadResult;
    try {
      console.log("🔄 Calling supabase.storage.from().upload()...");
      
      // Use the correct Supabase Storage upload API
      const { data, error } = await supabase.storage
        .from("guide-documents")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });
      
      console.log("✅ Upload call completed");
      uploadResult = { data, error };
      
    } catch (uploadError) {
      console.error("❌ Supabase upload exception:", {
        name: uploadError.name,
        message: uploadError.message,
        stack: uploadError.stack
      });
      return res.status(500).json({
        message: "File storage failed",
        detail: uploadError.message
      });
    }

    const { data, error } = uploadResult;
    
    console.log("📊 Upload result:", {
      hasData: !!data,
      hasError: !!error,
      data: data,
      error: error
    });

    if (error) {
      console.error("❌ Supabase upload error:", {
        message: error.message,
        statusCode: error.statusCode,
        error: error
      });
      
      // Provide more specific error messages
      if (error.message?.includes("Bucket not found")) {
        return res.status(500).json({
          message: "Storage configuration error. Please contact support.",
          detail: "Bucket 'guide-documents' not found"
        });
      }
      
      if (error.message?.includes("already exists")) {
        return res.status(409).json({
          message: "A file with this name already exists. Please try again."
        });
      }
      
      return res.status(500).json({
        message: "File storage failed. Please try again.",
        detail: error.message
      });
    }

    console.log("✅ Uploaded to Supabase:", data);

    /* ---------- SAVE TO DATABASE ---------- */
    console.log("💾 Saving to database:", {
      guide_id: guide.guide_id,
      document_type: normalizedType,
      file_name: file.originalname
    });
    
    await db.query(
      `INSERT INTO guide_documents (guide_id, document_type, document_url, file_name, file_size, mime_type, verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [guide.guide_id, normalizedType, filePath, file.originalname, file.size, file.mimetype]
    );
    
    console.log("✅ Document saved to database");

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
    console.error("\n❌❌❌ UPLOAD FAILED ❌❌❌");
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name,
      fullError: err
    });
    console.error("❌❌❌❌❌❌❌❌❌❌❌❌❌\n");
    
    // Check if response was already sent
    if (res.headersSent) {
      console.error("❌ Headers already sent, cannot send error response");
      return;
    }
    
    // Return more specific error information
    return res.status(500).json({ 
      message: "Document upload failed",
      error: err.message,
      detail: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
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
         tg.rejection_reason,
         tg.rejected_at,
         tg.approved_at,
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
       FROM guide_documents
       WHERE guide_id = $1
       ORDER BY uploaded_at DESC`,
      [guide.guide_id]
    );

    res.json({
      success: true,
      guide: {
        guide_id: guide.guide_id,
        full_name: guide.full_name,
        contact_number: guide.contact_number,
        email: guide.email,
        approved: guide.approved,
        status: guide.status,
        email_verified: guide.email_verified,
        rejection_reason: guide.rejection_reason,
        rejected_at: guide.rejected_at,
        approved_at: guide.approved_at,
        documents: docsResult.rows
      }
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
       FROM guide_documents
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

/* ======================================================
   GET GUIDE ASSIGNED BOOKINGS
   ====================================================== */
/**
 * GET MY ASSIGNED TOURS
 * Guide fetches all bookings assigned to them
 * GET /api/guide/my-tours
 * Auth: Required (Guide only)
 */
export const getGuideBookings = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide_id from user_id
    const guideResult = await db.query(
      `SELECT guide_id FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Guide profile not found" 
      });
    }

    const guideId = guideResult.rows[0].guide_id;

    // Get all bookings assigned to this guide using new column name
    const bookingsResult = await db.query(
      `SELECT 
        b.booking_id,
        b.booking_reference,
        b.travel_date,
        b.travelers,
        b.total_price,
        b.status,
        b.special_requests,
        b.guide_assigned_at,
        b.created_at,
        p.package_id,
        p.name as package_name,
        p.duration,
        p.category,
        p.description,
        p.destination,
        t.full_name as tourist_name,
        t.phone as tourist_phone,
        u.email as tourist_email,
        u.user_id as tourist_user_id
       FROM bookings b
       JOIN tour_packages p ON b.package_id = p.package_id
       JOIN users u ON b.user_id = u.user_id
       LEFT JOIN tourist t ON u.user_id = t.user_id
       WHERE b.assigned_guide_id = $1
       ORDER BY b.travel_date ASC, b.created_at DESC`,
      [guideId]
    );

    // Categorize bookings by status
    const bookings = bookingsResult.rows;
    const upcoming = bookings.filter(b => 
      b.status === 'confirmed' && new Date(b.travel_date) >= new Date()
    );
    const ongoing = bookings.filter(b => 
      b.status === 'confirmed' && new Date(b.travel_date) < new Date()
    );
    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings,
      categorized: {
        upcoming: upcoming,
        ongoing: ongoing,
        completed: completed,
        cancelled: cancelled,
        counts: {
          total: bookings.length,
          upcoming: upcoming.length,
          ongoing: ongoing.length,
          completed: completed.length,
          cancelled: cancelled.length
        }
      }
    });
  } catch (err) {
    console.error("❌ getGuideBookings error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch assigned bookings" 
    });
  }
};
