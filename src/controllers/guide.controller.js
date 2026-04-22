import supabase from "../config/supabase.js";
import db from "../config/db.js";
import { hashPassword } from "../utils/hash.js";
import { signToken } from "../utils/jwt.js";
import emailService from "../utils/emailService.js";
import { emailTemplates } from "../utils/emailTemplates.js";
import { generateEmailVerifyToken } from "../utils/tokens.js";

/**
 * Registers a new tour guide. Creates a user account with 'guide' role and 
 * an initial tour guide profile. Sends a verification email upon success.
 * 
 * @async
 * @function registerGuide
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Registration details.
 * @param {string} req.body.email - Email address for the account.
 * @param {string} req.body.password - Account password.
 * @param {string} req.body.full_name - Full name of the guide.
 * @param {string} [req.body.contact_number] - Optional contact number.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming successful registration.
 */
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

    // Generate email verification token
    const { token: verifyToken, hashedToken: hashedVerifyToken, expiresAt: verifyExpiresAt } =
      generateEmailVerifyToken();

    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, role, status, email_verified, email_verify_token, email_verify_expires, last_verification_email_sent)
       VALUES ($1, $2, 'guide', 'pending', false, $3, $4, NOW())
       RETURNING user_id`,
      [normalizedEmail, passwordHash, hashedVerifyToken, verifyExpiresAt]
    );

    const userId = userRes.rows[0].user_id;

    await db.query(
      `INSERT INTO tour_guide (user_id, full_name, contact_number, approved)
       VALUES ($1, $2, $3, false)`,
      [userId, full_name.trim(), contact_number?.trim() || null]
    );

    // Generate verification link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/verify-email?token=${verifyToken}`;
    console.log(`[TESTING] Verification Link: ${verificationLink}`);

    // Send verification email using unified service
    try {
      const verificationEmail = emailTemplates.emailVerification(full_name.trim(), verificationLink);
      await emailService.sendEmail(normalizedEmail, verificationEmail.subject, verificationEmail.html);
      console.log(`✅ Verification email sent to ${normalizedEmail}`);
    } catch (emailErr) {
      console.error("❌ Email send failed during guide registration:", emailErr);
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account."
    });

  } catch (err) {
    console.error("❌ Guide register error:", err);
    res.status(500).json({ message: "Guide registration failed" });
  }
};

/**
 * Uploads a verification document for a guide (e.g., license, ID card).
 * Validates the file and document type before storing in Supabase and recording in DB.
 * 
 * @async
 * @function uploadGuideDocuments
 * @param {Object} req - Express request object.
 * @param {Object} req.file - The document file to upload (via multer).
 * @param {Object} req.body - Metadata.
 * @param {string} req.body.document_type - Type of document ('license', 'certificate', etc.).
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the uploaded document metadata.
 */
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
      
      // Attempt to send document upload confirmation
      try {
        // Fallback to guideRegistration if guideDocumentUpload is missing in template
        const templateFunc = emailTemplates.guideDocumentUpload || emailTemplates.guideRegistration;
        const documentEmail = templateFunc(full_name, normalizedType);
        
        await emailService.sendEmail(email, documentEmail.subject, documentEmail.html);
        console.log(`✅ Document upload notification sent to ${email}`);
      } catch (notifErr) {
        console.error("❌ Document upload notification failed:", notifErr);
      }
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

/**
 * Retrieves the complete profile of the authenticated guide, including verification documents.
 * 
 * @async
 * @function getGuideProfile
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the guide's profile and documents.
 */
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

/**
 * Retrieves high-level dashboard information for an active guide.
 * Includes account status, document verification status, and tour summaries.
 * 
 * @async
 * @function getGuideDashboard
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with guide dashboard data.
 */
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
 * Retrieves all tour bookings assigned to the authenticated guide.
 * 
 * @async
 * @function getGuideBookings
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of assigned bookings.
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

/**
 * Uploads or updates the guide's profile photo.
 * Stores the photo in Supabase and updates the URL in the database.
 * 
 * @async
 * @function uploadProfilePhoto
 * @param {Object} req - Express request object.
 * @param {Object} req.file - The image file to upload (via multer).
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the new profile photo URL.
 */
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

/**
 * Deletes the authenticated guide's profile photo from storage and the database.
 * 
 * @async
 * @function deleteProfilePhoto
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion.
 */
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

/**
 * Updates basic profile information (name and contact) for the authenticated guide.
 * 
 * @async
 * @function updateGuideProfile
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Updated profile details.
 * @param {string} req.body.full_name - New full name.
 * @param {string} [req.body.contact_number] - New contact number.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated guide profile.
 */
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

/**
 * Retrieves details regarding an application rejection for the authenticated guide.
 * 
 * @async
 * @function getRejectionDetails
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with rejection reason and metadata.
 */
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

/**
 * Resubmits a guide application after it has been rejected, resetting the status to 'pending'.
 * 
 * @async
 * @function resubmitApplication
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming resubmission.
 */
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

/**
 * Retrieves comprehensive dashboard statistics for the authenticated guide.
 * Includes earnings, tour counts, ratings, trends, and recent reviews.
 * 
 * @async
 * @function getGuideDashboardStats
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with tabulated guide statistics.
 */
export const getGuideDashboardStats = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // 1. Get guide profile info
    const guideResult = await db.query(
      `SELECT guide_id, commission_rate FROM tour_guide WHERE user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const { guide_id: guideId, commission_rate: commissionRate } = guideResult.rows[0];

    console.log(`[GUIDE] Fetching dashboard stats for guide: ${guideId}`);

    // 2. Get tour counts
    const toursCountResult = await db.query(
      `SELECT 
        COUNT(*) as total_tours,
        COUNT(*) FILTER (WHERE travel_date > CURRENT_DATE AND status IN ('confirmed', 'pending')) as upcoming_tours,
        COUNT(*) FILTER (WHERE DATE(travel_date) = CURRENT_DATE AND status = 'confirmed') as ongoing_tours,
        COUNT(*) FILTER (WHERE status = 'completed' OR (status = 'confirmed' AND travel_date < CURRENT_DATE)) as completed_tours,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_tours
       FROM bookings
       WHERE assigned_guide_id = $1`,
      [guideId]
    );

    const counts = toursCountResult.rows[0];

    // 3. Get UNIFIED earnings (New commission_amount + Legacy 10% fallback)
    const earningsResult = await db.query(
      `SELECT 
        COALESCE(SUM(
          CASE 
            WHEN commission_amount IS NOT NULL THEN commission_amount
            ELSE (total_price * 0.10)
          END
        ), 0) as total_earnings
       FROM bookings
       WHERE assigned_guide_id = $1
       AND (status = 'completed' OR (status = 'confirmed' AND travel_date < CURRENT_DATE))`,
      [guideId]
    );

    const totalEarnings = parseFloat(earningsResult.rows[0].total_earnings) || 0;

    // 4. Get payout status distribution
    const payoutDetailsResult = await db.query(
      `SELECT 
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as total_paid,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('pending', 'approved')), 0) as total_pending
       FROM payout_requests
       WHERE guide_id = $1`,
      [guideId]
    );

    const totalPaid = parseFloat(payoutDetailsResult.rows[0].total_paid) || 0;
    const totalPending = parseFloat(payoutDetailsResult.rows[0].total_pending) || 0;
    const availableBalance = Math.max(0, totalEarnings - (totalPaid + totalPending));

    // 5. Get average rating from reviews
    const ratingResult = await db.query(
      `SELECT COALESCE(AVG(r.rating), 0) as avg_rating,
              COUNT(r.review_id) as total_reviews
       FROM reviews r
       JOIN bookings b ON r.booking_id = b.booking_id
       WHERE b.assigned_guide_id = $1`,
      [guideId]
    );

    // 6. Get Earnings Trend (Last 6 months)
    const earningsTrendResult = await db.query(
      `WITH RECURSIVE months AS (
        SELECT DATE_TRUNC('month', CURRENT_DATE) as month
        UNION ALL
        SELECT month - INTERVAL '1 month'
        FROM months
        WHERE month > DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      )
      SELECT
        TO_CHAR(m.month, 'Mon') as month,
        COALESCE(SUM(
          CASE 
            WHEN b.commission_amount IS NOT NULL THEN b.commission_amount
            ELSE (b.total_price * 0.10)
          END
        ), 0) as earnings
      FROM months m
      LEFT JOIN bookings b ON DATE_TRUNC('month', b.travel_date) = m.month
        AND b.assigned_guide_id = $1
        AND (b.status = 'completed' OR (b.status = 'confirmed' AND b.travel_date < CURRENT_DATE))
      GROUP BY m.month
      ORDER BY m.month;`,
      [guideId]
    );

    // 7. Get tour status distribution for charts
    const distribution = [
      { name: 'Completed', value: Number(counts.completed_tours) },
      { name: 'Upcoming', value: Number(counts.upcoming_tours) },
      { name: 'Ongoing', value: Number(counts.ongoing_tours) },
      { name: 'Cancelled', value: Number(counts.cancelled_tours) }
    ].filter(d => d.value > 0);

    // 8. Get top 4 upcoming active tours
    const nextToursResult = await db.query(
      `SELECT b.booking_id, b.travel_date, b.travelers, tp.name as package_name, b.status
       FROM bookings b
       JOIN tour_packages tp ON b.package_id = tp.package_id
       WHERE b.assigned_guide_id = $1
       AND b.travel_date >= CURRENT_DATE
       AND b.status IN ('confirmed', 'pending')
       ORDER BY b.travel_date ASC
       LIMIT 4`,
      [guideId]
    );

    // 9. Get Top 3 Recent Reviews
    const recentReviewsResult = await db.query(
      `SELECT 
         r.review_id, r.rating, r.comment, r.created_at,
         t.full_name as tourist_name, p.name as package_name
       FROM reviews r
       JOIN bookings b ON r.booking_id = b.booking_id
       JOIN tour_packages p ON b.package_id = p.package_id
       LEFT JOIN users u ON b.user_id = u.user_id
       LEFT JOIN tourist t ON u.user_id = t.user_id
       WHERE b.assigned_guide_id = $1
       ORDER BY r.created_at DESC
       LIMIT 3`,
      [guideId]
    );

    // 10. Calculate Earnings Delta
    const currentMonthEarnings = parseFloat(earningsTrendResult.rows[5]?.earnings) || 0;
    const lastMonthEarnings = parseFloat(earningsTrendResult.rows[4]?.earnings) || 0;
    let earningsDelta = 0;
    if (lastMonthEarnings > 0) {
      earningsDelta = ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100;
    } else if (currentMonthEarnings > 0) {
      earningsDelta = 100;
    }

    const stats = {
      totalTours: parseInt(counts.total_tours) || 0,
      upcomingTours: parseInt(counts.upcoming_tours) || 0,
      ongoingTours: parseInt(counts.ongoing_tours) || 0,
      completedTours: parseInt(counts.completed_tours) || 0,
      totalEarnings: totalEarnings,
      totalPaid: totalPaid,
      totalPending: totalPending,
      availableBalance: availableBalance,
      averageRating: parseFloat(ratingResult.rows[0].avg_rating).toFixed(1) || '0.0',
      totalReviews: parseInt(ratingResult.rows[0].total_reviews) || 0,
      commissionRate: parseFloat(commissionRate) || 0.10,
      earningsTrend: earningsTrendResult.rows,
      tourDistribution: distribution,
      nextTours: nextToursResult.rows,
      recentReviews: recentReviewsResult.rows,
      earningsDelta: Math.round(earningsDelta)
    };

    res.json({ success: true, stats });

  } catch (err) {
    console.error("[GUIDE] getDashboardStats error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch dashboard statistics" });
  }
};

/**
 * Retrieves the availability schedule for the authenticated guide for all future dates.
 * 
 * @async
 * @function getAvailability
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the guide's future availability.
 */
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
      `SELECT date, status
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

/**
 * Sets or updates the guide's availability for a specific date.
 * If status is missing, clearing availability record for that date.
 * 
 * @async
 * @function setAvailability
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Availability details.
 * @param {string} req.body.date - Date in YYYY-MM-DD format.
 * @param {string} [req.body.status] - New status (e.g., 'available', 'unavailable').
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming the update.
 */
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
      `INSERT INTO guide_availability (guide_id, date, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (guide_id, date)
       DO UPDATE SET status = EXCLUDED.status`,
      [guideId, date, status]
    );

    res.json({ success: true, message: "Availability updated" });
  } catch (err) {
    console.error("❌ setAvailability error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update availability",
      error: err.message,
      stack: err.stack
    });
  }
};

/**
 * Marks a confirmed tour booking as 'completed'.
 * Validates that the tour's end date has passed before allowing completion.
 * 
 * @async
 * @function markTourCompleted
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the booking to mark as completed.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming status change.
 */
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

/**
 * Retrieves all reviews and average rating for tours handled by the authenticated guide.
 * 
 * @async
 * @function getGuideReviews
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with review details and average rating.
 */
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

/**
 * Updates the bank account details of the authenticated guide for payout processing.
 * 
 * @async
 * @function updateBankDetails
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Bank details.
 * @param {string} req.body.bank_name - Name of the bank.
 * @param {string} req.body.account_no - Account number.
 * @param {string} req.body.account_name - Name of the account holder.
 * @param {string} [req.body.branch_name] - Name of the bank branch.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with updated bank information.
 */
export const updateBankDetails = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { bank_name, account_no, account_name, branch_name } = req.body;

    if (!bank_name || !account_no || !account_name) {
      return res.status(400).json({
        success: false,
        message: "Bank name, account number, and account name are required"
      });
    }

    const result = await db.query(
      `UPDATE tour_guide 
       SET bank_name = $1, account_no = $2, account_name = $3, branch_name = $4
       WHERE user_id = $5
       RETURNING *`,
      [bank_name, account_no, account_name, branch_name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    res.json({
      success: true,
      message: "Bank details updated successfully",
      guide: result.rows[0]
    });
  } catch (err) {
    console.error("❌ updateBankDetails error:", err);
    res.status(500).json({ success: false, message: "Failed to update bank details" });
  }
};

/**
 * Submits a new payout request for the guide's available earnings balance.
 * Validates account status, bank details, and available funds.
 * 
 * @async
 * @function requestPayout
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Payout details.
 * @param {number} req.body.amount - Amount requested for withdrawal.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created payout request.
 */
export const requestPayout = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payout amount" });
    }

    // 1. Get guide_id and check if bank details are set + check admin status
    const guideResult = await db.query(
      `SELECT tg.guide_id, tg.bank_name, tg.account_no, u.status 
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.user_id = $1`,
      [userId]
    );

    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const guide = guideResult.rows[0];

    // Security: Only active guides can request payouts
    if (guide.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account must be approved by an administrator before you can request payouts."
      });
    }
    if (!guide.bank_name || !guide.account_no) {
      return res.status(400).json({
        success: false,
        message: "Please set your bank details in your profile before requesting a payout"
      });
    }

    // 2. Calculate available balance using the UNIFIED logic
    const earningsResult = await db.query(
      `SELECT 
        COALESCE(SUM(
          CASE 
            WHEN commission_amount IS NOT NULL THEN commission_amount
            ELSE (total_price * 0.10)
          END
        ), 0) as total_earnings
       FROM bookings
       WHERE assigned_guide_id = $1
       AND (status = 'completed' OR (status = 'confirmed' AND travel_date < CURRENT_DATE))`,
      [guide.guide_id]
    );

    const payoutStatsResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_requested
       FROM payout_requests
       WHERE guide_id = $1
       AND status IN ('pending', 'approved', 'paid')`,
      [guide.guide_id]
    );

    const totalEarnings = parseFloat(earningsResult.rows[0].total_earnings) || 0;
    const totalRequested = parseFloat(payoutStatsResult.rows[0].total_requested) || 0;
    const availableBalance = Math.max(0, totalEarnings - totalRequested);

    if (Number(amount) > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${availableBalance.toFixed(2)}`
      });
    }

    // 3. Create payout request
    const result = await db.query(
      `INSERT INTO payout_requests (guide_id, amount, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [guide.guide_id, amount]
    );

    res.status(201).json({
      success: true,
      message: "Payout request submitted successfully",
      payout: result.rows[0]
    });

  } catch (err) {
    console.error("❌ requestPayout error:", err);
    res.status(500).json({ success: false, message: "Failed to submit payout request" });
  }
};

/**
 * Retrieves the payout history for the authenticated guide.
 * 
 * @async
 * @function getPayoutHistory
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated guide user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the history of payout requests.
 */
export const getPayoutHistory = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      `SELECT pr.*, u.email as processor_email
       FROM payout_requests pr
       JOIN tour_guide tg ON pr.guide_id = tg.guide_id
       LEFT JOIN users u ON pr.processed_by = u.user_id
       WHERE tg.user_id = $1
       ORDER BY pr.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      payouts: result.rows
    });
  } catch (err) {
    console.error("❌ getPayoutHistory error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch payout history" });
  }
};
