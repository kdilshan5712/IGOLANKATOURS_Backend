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
         tg.profile_photo,
         u.email,
         u.status,
         u.email_verified,
         u.created_at
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
        profile_photo: guide.profile_photo,
        created_at: guide.created_at,
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

    // Get document statistics
    const docsStatsResult = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE verified = true) as verified_docs,
         COUNT(*) FILTER (WHERE verified = false) as pending_docs
       FROM guide_documents
       WHERE guide_id = $1`,
      [guide.guide_id]
    );

    const docStats = docsStatsResult.rows[0] || { verified_docs: 0, pending_docs: 0 };

    // Get tour statistics
    const tourStatsResult = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE b.status = 'confirmed' AND b.travel_date > CURRENT_DATE) as upcoming_tours,
         COUNT(*) FILTER (WHERE b.status = 'confirmed' AND DATE(b.travel_date) = CURRENT_DATE) as ongoing_tours,
         COUNT(*) FILTER (WHERE b.status = 'completed' OR (b.travel_date < CURRENT_DATE AND b.status = 'confirmed')) as completed_tours
       FROM bookings b
       WHERE b.assigned_guide_id = $1`,
      [guide.guide_id]
    );

    const tourStats = tourStatsResult.rows[0] || {
      upcoming_tours: 0,
      ongoing_tours: 0,
      completed_tours: 0
    };

    res.json({
      message: "Dashboard access granted",
      guide: {
        guide_id: guide.guide_id,
        full_name: guide.full_name,
        approved: guide.approved,
        status: guide.status
      },
      stats: {
        verified_documents: parseInt(docStats.verified_docs),
        pending_documents: parseInt(docStats.pending_docs),
        upcoming_tours: parseInt(tourStats.upcoming_tours),
        ongoing_tours: parseInt(tourStats.ongoing_tours),
        completed_tours: parseInt(tourStats.completed_tours)
      }
    });
  } catch (err) {
    console.error("❌ getGuideDashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};

/**
 * GET GUIDE BOOKINGS
 * GET /api/guides/bookings
 */
export const getGuideBookings = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide_id
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

    // Get all bookings assigned to this guide
    const bookingsResult = await db.query(
      `SELECT 
        b.booking_id,
        b.travel_date,
        b.travelers,
        b.total_price,
        b.status,
        b.admin_notes,
        b.guide_assigned_at,
        b.created_at,
        p.package_id,
        p.name as package_name,
        p.duration,
        p.category,
        t.full_name as tourist_name,
        t.phone as tourist_phone,
        u.email as tourist_email
       FROM bookings b
       JOIN tour_packages p ON b.package_id = p.package_id
       JOIN users u ON b.user_id = u.user_id
       LEFT JOIN tourist t ON u.user_id = t.user_id
       WHERE b.assigned_guide_id = $1
       ORDER BY b.travel_date ASC, b.created_at DESC`,
      [guideId]
    );

    res.json({
      success: true,
      bookings: bookingsResult.rows
    });
  } catch (err) {
    console.error("❌ getGuideBookings error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings"
    });
  }
};

/* ======================================================
   UPLOAD PROFILE PHOTO
   POST /api/guide/profile-photo
   Auth: Required (Guide only)
   ====================================================== */
export const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: "File must be an image"
      });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Image size must be less than 5MB"
      });
    }

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id, profile_photo FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide profile not found"
      });
    }

    const guide = guideResult.rows[0];
    const oldPhotoPath = guide.profile_photo;

    // Generate unique file path
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${guide.guide_id}-${Date.now()}.${fileExt}`;
    const filePath = `profile-photos/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("guide-documents")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload photo to storage",
        detail: error.message
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("guide-documents")
      .getPublicUrl(filePath);

    const photoUrl = urlData?.publicUrl || filePath;

    // Update database
    await db.query(
      `UPDATE tour_guide 
       SET profile_photo = $1 
       WHERE guide_id = $2`,
      [photoUrl, guide.guide_id]
    );

    // Delete old photo from storage if exists
    if (oldPhotoPath && oldPhotoPath.startsWith('profile-photos/')) {
      await supabase.storage
        .from("guide-documents")
        .remove([oldPhotoPath])
        .catch(err => console.error("Failed to delete old photo:", err));
    }

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      profile_photo: photoUrl
    });

  } catch (err) {
    console.error("❌ uploadProfilePhoto error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile photo"
    });
  }
};

/* ======================================================
   DELETE PROFILE PHOTO
   DELETE /api/guide/profile-photo
   Auth: Required (Guide only)
   ====================================================== */
export const deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide_id and current photo
    const guideResult = await db.query(
      `SELECT guide_id, profile_photo FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide profile not found"
      });
    }

    const guide = guideResult.rows[0];
    const photoPath = guide.profile_photo;

    if (!photoPath) {
      return res.status(400).json({
        success: false,
        message: "No profile photo to delete"
      });
    }

    // Delete from storage if it's a storage path
    if (photoPath.startsWith('profile-photos/')) {
      const { error } = await supabase.storage
        .from("guide-documents")
        .remove([photoPath]);

      if (error) {
        console.error("Failed to delete photo from storage:", error);
      }
    }

    // Update database to remove photo URL
    await db.query(
      `UPDATE tour_guide 
       SET profile_photo = NULL 
       WHERE guide_id = $1`,
      [guide.guide_id]
    );

    res.json({
      success: true,
      message: "Profile photo deleted successfully"
    });

  } catch (err) {
    console.error("❌ deleteProfilePhoto error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete profile photo"
    });
  }
};

/* ======================================================
   UPDATE GUIDE PROFILE
   PUT /api/guide/me
   Auth: Required (Guide only)
   ====================================================== */
export const updateGuideProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { full_name, contact_number } = req.body;

    // Validate input
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required"
      });
    }

    // Get guide_id
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

    // Update profile
    const result = await db.query(
      `UPDATE tour_guide 
       SET full_name = $1,
           contact_number = $2
       WHERE guide_id = $3
       RETURNING *`,
      [full_name.trim(), contact_number?.trim() || null, guideId]
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      guide: result.rows[0]
    });

  } catch (err) {
    console.error("❌ updateGuideProfile error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
};

// ======================================================
//    GET REJECTION DETAILS
//    GET /api/guide/rejection-details
//    Auth: Required (Rejected Guide only)
//    ====================================================== */
export const getRejectionDetails = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get rejection details from tour_guide table
    const result = await db.query(
      `SELECT tg.rejection_reason, tg.rejected_at, tg.rejected_by,
              a.email as rejected_by_email
       FROM tour_guide tg
       LEFT JOIN users u_admin ON tg.rejected_by = u_admin.user_id
       LEFT JOIN admin a ON u_admin.user_id = a.user_id
       WHERE tg.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide profile not found"
      });
    }

    const rejectionData = result.rows[0];

    // Check if actually rejected
    const userStatus = await db.query(
      `SELECT status FROM users WHERE user_id = $1`,
      [userId]
    );

    if (userStatus.rows[0].status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: "Account is not in rejected status"
      });
    }

    res.json({
      success: true,
      rejection: {
        reason: rejectionData.rejection_reason,
        rejectedAt: rejectionData.rejected_at,
        rejectedBy: rejectionData.rejected_by_email || 'Admin'
      }
    });

  } catch (err) {
    console.error("[GUIDE] getRejectionDetails error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get rejection details"
    });
  }
};

// ======================================================
//    RESUBMIT APPLICATION
//    POST /api/guide/resubmit
//    Auth: Required (Rejected Guide only)
//    ====================================================== */
export const resubmitApplication = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Verify user is currently rejected
    const userCheck = await db.query(
      `SELECT status FROM users WHERE user_id = $1`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (userCheck.rows[0].status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: "Only rejected guides can resubmit applications"
      });
    }

    // Update user status from rejected to pending
    await db.query(
      `UPDATE users
       SET status = 'pending'
       WHERE user_id = $1`,
      [userId]
    );

    // Update tour_guide: set approved = false, clear rejection fields
    await db.query(
      `UPDATE tour_guide
       SET approved = false,
           rejection_reason = NULL,
           rejected_at = NULL,
           rejected_by = NULL
       WHERE user_id = $1`,
      [userId]
    );

    // Get guide details for logging
    const guideResult = await db.query(
      `SELECT full_name, email
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.user_id = $1`,
      [userId]
    );

    const guide = guideResult.rows[0];

    console.log(`[GUIDE] Application resubmitted: ${guide.full_name} (${guide.email})`);

    // Optional: Send notification email to admin
    // You can implement this later if needed

    res.json({
      success: true,
      message: "Application resubmitted successfully. Your application is now pending admin review."
    });

  } catch (err) {
    console.error("[GUIDE] resubmitApplication error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resubmit application"
    });
  }
};

/* ======================================================
   GET GUIDE DASHBOARD STATISTICS
   GET /api/guide/dashboard/stats
   ====================================================== */
export const getGuideDashboardStats = async (req, res) => {
  try {
    const guideId = req.user.user_id;

    console.log(`[GUIDE] Fetching dashboard stats for guide: ${guideId}`);

    // Get total tours assigned
    const toursResult = await db.query(
      `SELECT COUNT(*) as total_tours
       FROM bookings
       WHERE assigned_guide_id = $1`,
      [guideId]
    );

    // Get upcoming tours (future tours that are confirmed or pending)
    const upcomingResult = await db.query(
      `SELECT COUNT(*) as upcoming_tours
       FROM bookings
       WHERE assigned_guide_id = $1
       AND travel_date > CURRENT_DATE
       AND status IN ('confirmed', 'pending')`,
      [guideId]
    );

    // Get ongoing tours (started today)
    // Matching logic from getGuideDashboard: status confirmed AND date is today
    const ongoingResult = await db.query(
      `SELECT COUNT(*) as ongoing_tours
       FROM bookings
       WHERE assigned_guide_id = $1
       AND DATE(travel_date) = CURRENT_DATE
       AND status = 'confirmed'`,
      [guideId]
    );

    // Get completed tours
    // Matching logic from getGuideDashboard: status completed OR (status confirmed AND date < today)
    const completedResult = await db.query(
      `SELECT COUNT(*) as completed_tours
       FROM bookings
       WHERE assigned_guide_id = $1
       AND (status = 'completed' OR (status = 'confirmed' AND travel_date < CURRENT_DATE))`,
      [guideId]
    );

    // Get total earnings (sum of completed tour commissions)
    // Assuming guide gets 10% commission on total price
    const earningsResult = await db.query(
      `SELECT COALESCE(SUM(total_price * 0.10), 0) as total_earnings
       FROM bookings
       WHERE assigned_guide_id = $1
       AND (status = 'completed' OR (status = 'confirmed' AND travel_date < CURRENT_DATE))`,
      [guideId]
    );

    // Get average rating from reviews
    const ratingResult = await db.query(
      `SELECT COALESCE(AVG(r.rating), 0) as avg_rating,
              COUNT(r.review_id) as review_count
       FROM reviews r
       JOIN bookings b ON r.booking_id = b.booking_id
       WHERE b.assigned_guide_id = $1`,
      [guideId]
    );

    const stats = {
      totalTours: parseInt(toursResult.rows[0].total_tours) || 0,
      upcomingTours: parseInt(upcomingResult.rows[0].upcoming_tours) || 0,
      ongoingTours: parseInt(ongoingResult.rows[0].ongoing_tours) || 0,
      completedTours: parseInt(completedResult.rows[0].completed_tours) || 0,
      totalEarnings: parseFloat(earningsResult.rows[0].total_earnings) || 0,
      averageRating: parseFloat(ratingResult.rows[0].avg_rating).toFixed(1) || '0.0',
      reviewCount: parseInt(ratingResult.rows[0].review_count) || 0
    };

    console.log(`[GUIDE] Dashboard stats calculated:`, stats);

    res.json({
      success: true,
      stats
    });

  } catch (err) {
    console.error("[GUIDE] getDashboardStats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics"
    });
  }
};

/* ======================================================
   GET GUIDE AVAILABILITY
   GET /api/guide/availability
   ====================================================== */
export const getAvailability = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const guideId = guideResult.rows[0].guide_id;

    // Get all future availability
    const availResult = await db.query(
      `SELECT date, status, notes
       FROM guide_availability
       WHERE guide_id = $1 AND date >= CURRENT_DATE
       ORDER BY date ASC`,
      [guideId]
    );

    // Format dates to YYYY-MM-DD
    const availability = availResult.rows.map(row => ({
      ...row,
      date: new Date(row.date).toISOString().split('T')[0]
    }));

    res.json({
      success: true,
      availability
    });
  } catch (err) {
    console.error("❌ getAvailability error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch availability" });
  }
};

/* ======================================================
   SET GUIDE AVAILABILITY
   POST /api/guide/availability
   ====================================================== */
export const setAvailability = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { date, status, notes } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required" });
    }

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const guideId = guideResult.rows[0].guide_id;

    // If status is empty/null, delete the record (acting as a toggle clear)
    if (!status || status.trim() === '') {
      await db.query(
        `DELETE FROM guide_availability WHERE guide_id = $1 AND date = $2`,
        [guideId, date]
      );
      return res.json({ success: true, message: "Availability cleared" });
    }

    // Insert or update
    await db.query(
      `INSERT INTO guide_availability (guide_id, date, status, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guide_id, date)
       DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
      [guideId, date, status, notes || null]
    );

    res.json({ success: true, message: "Availability updated" });
  } catch (err) {
    console.error("❌ setAvailability error:", err);
    res.status(500).json({ success: false, message: "Failed to update availability" });
  }
};

/* ======================================================
   MARK TOUR AS COMPLETED
   PATCH /api/guide/bookings/:id/complete
   ====================================================== */
export const markTourCompleted = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const bookingId = req.params.id;

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const guideId = guideResult.rows[0].guide_id;

    // Verify booking belongs to guide and is confirmed
    const bookingResult = await db.query(
      `SELECT b.status, b.travel_date, p.duration 
       FROM bookings b
       JOIN tour_packages p ON b.package_id = p.package_id
       WHERE b.booking_id = $1 AND b.assigned_guide_id = $2`,
      [bookingId, guideId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Booking not found or not assigned to you" });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: "Only confirmed tours can be marked as completed" });
    }

    // Verify travel date has passed or we are on the last day of the tour
    const travelDate = new Date(booking.travel_date);
    let durationDays = 1; // Default duration
    if (booking.duration) {
      const durationMatch = String(booking.duration).match(/\d+/);
      if (durationMatch) {
        durationDays = parseInt(durationMatch[0], 10);
      }
    }

    const endDate = new Date(travelDate);
    endDate.setDate(endDate.getDate() + durationDays - 1); // e.g. 1 day tour ends on the same day

    // Normalize dates for comparison (ignore time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (today < endDate) {
      return res.status(400).json({
        success: false,
        message: `Tour is not completed yet. It ends on ${endDate.toLocaleDateString()}`
      });
    }

    // Update status to completed
    await db.query(
      `UPDATE bookings 
       SET status = 'completed', updated_at = NOW() 
       WHERE booking_id = $1 AND assigned_guide_id = $2`,
      [bookingId, guideId]
    );

    res.json({
      success: true,
      message: "Tour successfully marked as completed"
    });

  } catch (err) {
    console.error("❌ markTourCompleted error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark tour as completed"
    });
  }
};

/* ======================================================
   GET GUIDE REVIEWS
   GET /api/guide/reviews
   ====================================================== */
export const getGuideReviews = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get guide_id
    const guideResult = await db.query(
      `SELECT guide_id FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const guideId = guideResult.rows[0].guide_id;

    // Fetch reviews for bookings assigned to this guide
    const reviewsResult = await db.query(
      `SELECT 
         r.review_id,
         r.rating,
         r.comment,
         r.created_at,
         b.booking_id,
         b.travel_date,
         p.name as package_name,
         t.full_name as tourist_name
       FROM reviews r
       JOIN bookings b ON r.booking_id = b.booking_id
       JOIN tour_packages p ON b.package_id = p.package_id
       LEFT JOIN users u ON b.user_id = u.user_id
       LEFT JOIN tourist t ON u.user_id = t.user_id
       WHERE b.assigned_guide_id = $1
       ORDER BY r.created_at DESC`,
      [guideId]
    );

    // Calculate average rating
    const totalReviews = reviewsResult.rows.length;
    let averageRating = 0;

    if (totalReviews > 0) {
      const sum = reviewsResult.rows.reduce((acc, rev) => acc + Number(rev.rating), 0);
      averageRating = (sum / totalReviews).toFixed(1);
    }

    res.json({
      success: true,
      reviews: reviewsResult.rows,
      stats: {
        totalReviews,
        averageRating: Number(averageRating)
      }
    });

  } catch (err) {
    console.error("❌ getGuideReviews error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews"
    });
  }
};
