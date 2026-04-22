/**
 * Retrieves all guide-uploaded documents for admin verification.
 * 
 * @async
 * @function getAllGuideDocuments
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of guide documents.
 */
export const getAllGuideDocuments = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         gd.document_id,
         gd.document_type,
         gd.verified,
         gd.uploaded_at,
         gd.guide_id,
         tg.full_name AS guide_full_name,
         u.email AS guide_email
       FROM guide_documents gd
       JOIN tour_guide tg ON gd.guide_id = tg.guide_id
       JOIN users u ON tg.user_id = u.user_id
       ORDER BY gd.uploaded_at DESC`
    );
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch guide documents" });
  }
};

/**
 * Fetches guides along with their associated documents, with optional status filtering.
 * Used for the admin dashboard to manage guide applications.
 * 
 * @async
 * @function getGuidesWithDocuments
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.status] - Status filter ('pending', 'approved', 'rejected').
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with guide summaries and documents.
 */
export const getGuidesWithDocuments = async (req, res) => {
  try {
    const { status } = req.query;

    console.log('📋 Fetching guides with documents, status filter:', status);

    // Build WHERE clause based on status filter
    let whereConditions = ["u.role = 'guide'"];

    if (status === "pending") {
      whereConditions.push("u.status = 'pending'");
    } else if (status === "approved") {
      whereConditions.push("tg.approved = true");
      whereConditions.push("u.status = 'active'");
    } else if (status === "rejected") {
      whereConditions.push("u.status = 'rejected'");
    }

    const whereClause = whereConditions.join(' AND ');

    // Single query with LEFT JOIN and document aggregation
    const result = await db.query(`
      SELECT 
        tg.guide_id,
        tg.full_name,
        tg.contact_number,
        tg.approved,
        u.user_id,
        u.email,
        u.status,
        u.created_at,
        (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id) AS document_count,
        COALESCE(
          json_agg(
            CASE 
              WHEN gd.document_id IS NOT NULL THEN
                json_build_object(
                  'document_id', gd.document_id,
                  'document_type', gd.document_type,
                  'document_url', gd.document_url,
                  'verified', gd.verified,
                  'uploaded_at', gd.uploaded_at
                )
              ELSE NULL
            END
          ) FILTER (WHERE gd.document_id IS NOT NULL),
          '[]'
        ) as documents
      FROM tour_guide tg
      INNER JOIN users u ON tg.user_id = u.user_id
      LEFT JOIN guide_documents gd ON tg.guide_id = gd.guide_id
      WHERE ${whereClause}
      GROUP BY tg.guide_id, tg.full_name, tg.contact_number, tg.approved,
               u.user_id, u.email, u.status, u.created_at
      ORDER BY u.created_at DESC
    `);

    console.log(`✅ Found ${result.rows.length} guides`);

    res.json({
      success: true,
      count: result.rows.length,
      guides: result.rows.map(row => ({
        guide_id: row.guide_id,
        full_name: row.full_name,
        contact_number: row.contact_number,
        languages: null, // Not in current schema
        experience_years: null, // Not in current schema
        license_number: null, // Not in current schema
        email: row.email,
        status: row.status,
        approved: row.approved,
        approved_at: null, // Not in current schema
        approved_by_email: null, // Not in current schema
        rejection_reason: null, // Not in current schema
        created_at: row.created_at,
        document_count: parseInt(row.document_count) || 0,
        documents: row.documents
      }))
    });
  } catch (err) {
    console.error("❌ getGuidesWithDocuments error:", err);
    console.error("❌ Error message:", err.message);
    console.error("❌ Error code:", err.code);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch guides with documents",
      error: err.message,
      errorCode: err.code
    });
  }
};

/**
 * Verifies a guide's document. If all required documents are verified, approves the guide.
 * 
 * @async
 * @function approveGuideDocument
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.document_id - ID of the document to approve.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming document approval.
 */
export const approveGuideDocument = async (req, res) => {
  try {
    const { document_id } = req.params;

    // Approve the document
    await db.query(
      `UPDATE guide_documents SET verified = true WHERE document_id = $1`,
      [document_id]
    );

    // Get the guide_id for this document
    const docResult = await db.query(
      `SELECT guide_id FROM guide_documents WHERE document_id = $1`,
      [document_id]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    const guide_id = docResult.rows[0].guide_id;

    // Check if all documents for this guide are verified
    const allDocs = await db.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE verified) AS verified_count
       FROM guide_documents WHERE guide_id = $1`,
      [guide_id]
    );
    if (allDocs.rows[0].total === allDocs.rows[0].verified_count) {
      // Approve the guide and activate user
      await db.query(
        `UPDATE tour_guide SET approved = true WHERE guide_id = $1`,
        [guide_id]
      );
      await db.query(
        `UPDATE users SET status = 'active'
         WHERE user_id = (SELECT user_id FROM tour_guide WHERE guide_id = $1)`,
        [guide_id]
      );
    }

    res.json({ success: true, message: "Document approved" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to approve document" });
  }
};

/**
 * Rejects a guide's document by marking verified as false.
 * 
 * @async
 * @function rejectGuideDocument
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.document_id - ID of the document to reject.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming document rejection.
 */
export const rejectGuideDocument = async (req, res) => {
  try {
    const { document_id } = req.params;
    // Set verified = false (do not delete file)
    await db.query(
      `UPDATE guide_document SET verified = false WHERE document_id = $1`,
      [document_id]
    );
    res.json({ success: true, message: "Document rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reject document" });
  }
};
import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";
import supabase from "../config/supabase.js";

/**
 * Generates a Supabase URL (signed or public) for a specific guide document.
 * 
 * @async
 * @function getDocumentUrl
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide.
 * @param {string} req.params.documentId - ID of the document.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the generated URL.
 */
export const getDocumentUrl = async (req, res) => {
  try {
    const { guideId, documentId } = req.params;

    // Get document path from database
    const result = await db.query(
      `SELECT document_url FROM guide_documents 
       WHERE document_id = $1 AND guide_id = $2`,
      [documentId, guideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const documentPath = result.rows[0].document_url;

    // Try to generate public URL first
    const { data: publicData } = supabase.storage
      .from("guide-documents")
      .getPublicUrl(documentPath);

    // If bucket might be private, generate a signed URL (valid for 1 hour)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("guide-documents")
      .createSignedUrl(documentPath, 3600); // 1 hour expiry

    if (signedError) {
      console.error("Error creating signed URL:", signedError);
      // Fall back to public URL even if it might not work
      return res.json({
        success: true,
        url: publicData.publicUrl
      });
    }

    // Prefer signed URL as it works for both public and private buckets
    res.json({
      success: true,
      url: signedData.signedUrl
    });
  } catch (err) {
    console.error("Error getting document URL:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get document URL"
    });
  }
};

/**
 * Retrieves a list of guides with 'pending' status who are not yet approved.
 * 
 * @async
 * @function getPendingGuides
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of pending guides.
 */
export const getPendingGuides = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         tg.guide_id,
         u.user_id,
         u.email,
         tg.full_name,
         tg.contact_number,
         tg.languages,
         tg.experience_years,
         tg.license_number,
         u.status,
         tg.approved,
         tg.created_at,
         (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id) as document_count
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE u.status = 'pending' AND tg.approved = false
       ORDER BY tg.created_at DESC`
    );

    res.json({
      success: true,
      count: result.rows.length,
      guides: result.rows
    });
  } catch (err) {
    console.error("Admin getPendingGuides error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending guides"
    });
  }
};

/**
 * Lists all documents uploaded by a specific guide.
 * 
 * @async
 * @function getGuideDocuments
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the guide's documents.
 */
export const getGuideDocuments = async (req, res) => {
  try {
    const { guideId } = req.params;

    // Validate guideId
    if (!guideId || isNaN(guideId)) {
      return res.status(400).json({ message: "Invalid guide ID" });
    }

    // Check if guide exists
    const guideCheck = await db.query(
      `SELECT guide_id FROM tour_guide WHERE guide_id = $1`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      return res.status(404).json({ message: "Guide not found" });
    }

    const result = await db.query(
      `SELECT 
         document_id,
         document_type,
         document_url,
         file_name,
         file_size,
         mime_type,
         verified,
         verified_by,
         verified_at,
         uploaded_at
       FROM guide_documents
       WHERE guide_id = $1
       ORDER BY uploaded_at DESC`,
      [guideId]
    );

    res.json({
      guide_id: parseInt(guideId),
      count: result.rows.length,
      documents: result.rows
    });
  } catch (err) {
    console.error("Admin getGuideDocuments error:", err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};

/**
 * Formally approves a guide application, triggers the activation function,
 * and sends an approval notification email.
 * 
 * @async
 * @function approveGuide
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to approve.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {string} req.user.user_id - ID of the admin performing the approval.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide approval.
 */
export const approveGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    const adminUserId = req.user.user_id; // From auth middleware

    // Validate guideId
    if (!guideId || isNaN(guideId)) {
      return res.status(400).json({ message: "Invalid guide ID" });
    }

    // Check if guide exists and is pending
    const guideCheck = await db.query(
      `SELECT tg.guide_id, tg.approved, u.status
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      return res.status(404).json({ message: "Guide not found" });
    }

    const guide = guideCheck.rows[0];

    if (guide.approved) {
      return res.status(400).json({ message: "Guide already approved" });
    }

    // Check if guide has at least one document
    const docCheck = await db.query(
      `SELECT COUNT(*) as doc_count FROM guide_documents WHERE guide_id = $1`,
      [guideId]
    );

    if (parseInt(docCheck.rows[0].doc_count) === 0) {
      return res.status(400).json({
        message: "Cannot approve guide without documents"
      });
    }

    // Use approve_guide function
    const result = await db.query(
      `SELECT * FROM approve_guide($1, $2)`,
      [parseInt(guideId), adminUserId]
    );

    if (!result.rows[0].success) {
      return res.status(400).json({
        message: result.rows[0].message
      });
    }

    // Mark all documents as verified
    await db.query(
      `UPDATE guide_documents
       SET verified = true, verified_by = $1, verified_at = NOW()
       WHERE guide_id = $2`,
      [adminUserId, guideId]
    );

    // Get guide email and name for notification
    const guideInfoResult = await db.query(
      `SELECT u.email, tg.full_name
       FROM users u
       JOIN tour_guide tg ON u.user_id = tg.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideInfoResult.rows.length > 0) {
      const { email, full_name } = guideInfoResult.rows[0];
      const approvalEmail = emailTemplates.guideApproved(full_name);
      sendEmail(email, approvalEmail.subject, approvalEmail.html)
        .catch(err => console.error("Email send failed:", err));
    }

    res.json({
      success: true,
      message: "Guide approved successfully"
    });
  } catch (err) {
    console.error("Admin approveGuide error:", err);
    res.status(500).json({ message: "Failed to approve guide" });
  }
};

/**
 * Rejects a guide application, updates their status to 'rejected' with a reason,
 * and sends a rejection notification email.
 * 
 * @async
 * @function rejectGuide
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to reject.
 * @param {Object} req.body - Request body.
 * @param {string} [req.body.reason] - Optional cancellation reason.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {string} req.user.user_id - ID of the admin performing the rejection.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide rejection.
 */
export const rejectGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user.user_id; // From auth middleware

    // Validate guideId
    if (!guideId || isNaN(guideId)) {
      return res.status(400).json({ message: "Invalid guide ID" });
    }

    // Check if guide exists
    const guideCheck = await db.query(
      `SELECT tg.guide_id, tg.approved, u.status
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      return res.status(404).json({ message: "Guide not found" });
    }

    const guide = guideCheck.rows[0];

    if (guide.approved) {
      return res.status(400).json({
        message: "Cannot reject an already approved guide"
      });
    }

    if (guide.status === "rejected") {
      return res.status(400).json({
        message: "Guide already rejected"
      });
    }

    const rejectionReason = reason?.trim() || "Documents not valid or incomplete";

    // Use reject_guide function
    const result = await db.query(
      `SELECT * FROM reject_guide($1, $2, $3)`,
      [parseInt(guideId), adminUserId, rejectionReason]
    );

    if (!result.rows[0].success) {
      return res.status(400).json({
        message: result.rows[0].message
      });
    }

    // Get guide email and name for notification
    const guideInfoResult = await db.query(
      `SELECT u.email, tg.full_name
       FROM users u
       JOIN tour_guide tg ON u.user_id = tg.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideInfoResult.rows.length > 0) {
      const { email, full_name } = guideInfoResult.rows[0];
      const rejectionEmail = emailTemplates.guideRejected(full_name, rejectionReason);
      sendEmail(email, rejectionEmail.subject, rejectionEmail.html)
        .catch(err => console.error("Email send failed:", err));
    }

    res.json({
      message: "Guide rejected successfully",
      reason: rejectionReason
    });
  } catch (err) {
    console.error("Admin rejectGuide error:", err);
    res.status(500).json({ message: "Failed to reject guide" });
  }
};

/**
 * Retrieves all registered guides with optional status filtering.
 * Returns comprehensive guide data including verification details and document counts.
 * 
 * @async
 * @function getAllGuides
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.status] - User status filter ('active', 'pending', 'rejected').
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of all guides.
 */
export const getAllGuides = async (req, res) => {
  try {
    const { status } = req.query; // Filter by status: pending, approved, rejected

    let query = `
      SELECT 
        tg.guide_id,
        tg.user_id,
        u.email,
        tg.full_name,
        tg.contact_number,
        tg.languages,
        tg.experience_years,
        tg.license_number,
        tg.approved,
        tg.rejection_reason,
        tg.approved_by,
        tg.approved_at,
        tg.created_at,
        u.status as user_status,
        admin_user.email as approved_by_email,
        (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id) as document_count
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      LEFT JOIN users admin_user ON tg.approved_by = admin_user.user_id
    `;

    const params = [];
    if (status) {
      query += ` WHERE u.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY tg.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      guides: result.rows
    });
  } catch (err) {
    console.error("Admin getAllGuides error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch guides"
    });
  }
};

/**
 * Fetches detailed information for a single guide, including their verification documents.
 * 
 * @async
 * @function getGuideDetails
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to fetch.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with guide profile and documents.
 */
export const getGuideDetails = async (req, res) => {
  try {
    const { guideId } = req.params;

    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Invalid guide ID"
      });
    }

    const result = await db.query(
      `SELECT 
        tg.guide_id,
        tg.user_id,
        u.email,
        tg.full_name,
        tg.contact_number,
        tg.approved,
        u.status as user_status,
        u.created_at as user_created_at,
        u.created_at
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide not found"
      });
    }

    // Get documents
    const documentsResult = await db.query(
      `SELECT 
        document_id,
        document_type,
        document_url,
        verified,
        uploaded_at
      FROM guide_documents
      WHERE guide_id = $1
      ORDER BY uploaded_at DESC`,
      [guideId]
    );

    const guide = result.rows[0];
    guide.documents = documentsResult.rows;

    // Add fields that don't exist in schema as null
    guide.languages = null;
    guide.experience_years = null;
    guide.license_number = null;
    guide.rejection_reason = null;
    guide.approved_by = null;
    guide.approved_at = null;
    guide.approved_by_email = null;
    guide.approved_by_name = null;

    res.json({
      success: true,
      guide
    });
  } catch (err) {
    console.error("Admin getGuideDetails error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch guide details"
    });
  }
};

/**
 * Uploads a profile photo for the authenticated admin to Supabase storage
 * and updates the admin profile in the database.
 * 
 * @async
 * @function uploadProfilePhoto
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {Object} req.file - The uploaded file object (from Multer).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the new photo URL.
 */
export const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, message: "File must be an image" });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Image size must be less than 5MB" });
    }

    const adminResult = await db.query(
      `SELECT profile_photo FROM admin WHERE user_id = $1`,
      [userId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Admin profile not found" });
    }

    const oldPhotoPath = adminResult.rows[0].profile_photo;

    const fileExt = file.originalname.split('.').pop();
    const fileName = `admin-${userId}-${Date.now()}.${fileExt}`;
    const filePath = `admin-photos/${fileName}`;

    const { data, error } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ success: false, message: "Failed to upload photo to storage", detail: error.message });
    }

    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    const photoUrl = urlData?.publicUrl || filePath;

    await db.query(
      `UPDATE admin SET profile_photo = $1 WHERE user_id = $2`,
      [photoUrl, userId]
    );

    if (oldPhotoPath && oldPhotoPath.includes('profile-photos/')) {
      try {
        const oldPathRaw = oldPhotoPath.split('profile-photos/')[1];
        await supabase.storage.from("profile-photos").remove([oldPathRaw]);
      } catch (err) {
        console.error("Failed to delete old admin photo:", err);
      }
    }

    res.json({ success: true, message: "Profile photo uploaded successfully", profile_photo: photoUrl });
  } catch (err) {
    console.error("❌ admin uploadProfilePhoto error:", err);
    res.status(500).json({ success: false, message: "Failed to upload profile photo" });
  }
};

/**
 * Deletes the authenticated admin's profile photo from storage and database.
 * 
 * @async
 * @function deleteProfilePhoto
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming photo deletion.
 */
export const deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const adminResult = await db.query(
      `SELECT profile_photo FROM admin WHERE user_id = $1`,
      [userId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Admin profile not found" });
    }

    const photoPath = adminResult.rows[0].profile_photo;

    if (!photoPath) {
      return res.status(400).json({ success: false, message: "No profile photo to delete" });
    }

    if (photoPath.includes('profile-photos/')) {
      try {
        const oldPathRaw = photoPath.split('profile-photos/')[1];
        await supabase.storage.from("profile-photos").remove([oldPathRaw]);
      } catch (err) {
        console.error("Failed to delete photo from storage:", err);
      }
    }

    await db.query(
      `UPDATE admin SET profile_photo = NULL WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, message: "Profile photo deleted successfully" });
  } catch (err) {
    console.error("❌ admin deleteProfilePhoto error:", err);
    res.status(500).json({ success: false, message: "Failed to delete profile photo" });
  }
};

/**
 * Retrieves all pending guide applications using the 'pending_guide_applications' view.
 * 
 * @async
 * @function getPendingApplications
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with pending applications.
 */
export const getPendingApplications = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM pending_guide_applications`
    );

    res.json({
      success: true,
      count: result.rows.length,
      applications: result.rows
    });
  } catch (err) {
    console.error("Admin getPendingApplications error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending applications"
    });
  }
};

/**
 * Retrieves all approved guides using the 'approved_guides' view.
 * 
 * @async
 * @function getApprovedGuides
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with approved guides.
 */
export const getApprovedGuides = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM approved_guides`
    );

    res.json({
      success: true,
      count: result.rows.length,
      guides: result.rows
    });
  } catch (err) {
    console.error("Admin getApprovedGuides error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approved guides"
    });
  }
};
/**
 * Alternative action to approve a guide from the dashboard.
 * Sets approved status, activates the user, and verifies all documents.
 * 
 * @async
 * @function approveGuideAction
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide approval.
 */
export const approveGuideAction = async (req, res) => {
  try {
    const { guideId } = req.params;
    const adminUserId = req.user.user_id;

    // Validate guideId
    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Invalid guide ID"
      });
    }

    // Check if guide exists
    const guideCheck = await db.query(
      `SELECT tg.guide_id, tg.approved, u.user_id, u.email, tg.full_name
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide not found"
      });
    }

    const guide = guideCheck.rows[0];

    if (guide.approved) {
      return res.status(400).json({
        success: false,
        message: "Guide is already approved"
      });
    }

    // Approve the guide
    await db.query(
      `UPDATE tour_guide SET approved = true WHERE guide_id = $1`,
      [guideId]
    );

    // Activate the user
    await db.query(
      `UPDATE users SET status = 'active' WHERE user_id = $1`,
      [guide.user_id]
    );

    // Mark all documents as verified
    await db.query(
      `UPDATE guide_documents SET verified = true WHERE guide_id = $1`,
      [guideId]
    );

    // Send approval email
    const approvalEmail = emailTemplates.guideApproved(guide.full_name);
    sendEmail(guide.email, approvalEmail.subject, approvalEmail.html)
      .catch(err => console.error("Email send failed:", err));

    res.json({
      success: true,
      message: "Guide approved successfully"
    });
  } catch (err) {
    console.error("Admin approveGuideAction error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to approve guide"
    });
  }
};

/**
 * Alternative action to reject a guide from the dashboard.
 * Marks guide as not approved, rejects the user status, and sends notification.
 * 
 * @async
 * @function rejectGuideAction
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to reject.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.rejection_reason - Required reason for rejection.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming rejection.
 */
export const rejectGuideAction = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { rejection_reason } = req.body;

    // Validate guideId
    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Invalid guide ID"
      });
    }

    // Validate rejection reason
    if (typeof rejection_reason !== "string" || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    // Check if guide exists
    const guideCheck = await db.query(
      `SELECT tg.guide_id, tg.approved, u.user_id, u.email, tg.full_name
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );

    if (guideCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Guide not found"
      });
    }

    const guide = guideCheck.rows[0];

    // Update tour_guide: set approved to false
    await db.query(
      `UPDATE tour_guide SET approved = false WHERE guide_id = $1`,
      [guideId]
    );

    // Update user status to rejected
    await db.query(
      `UPDATE users SET status = 'rejected' WHERE user_id = $1`,
      [guide.user_id]
    );

    // Send rejection email (non-blocking)
    try {
      const rejectionEmail = emailTemplates.guideRejected(guide.full_name, rejection_reason);
      await sendEmail(guide.email, rejectionEmail.subject, rejectionEmail.html);
    } catch (emailError) {
      console.error("❌ Failed to send rejection email:", emailError);
      // Continue anyway - guide is already rejected in DB
    }

    return res.json({
      success: true,
      message: "Guide rejected successfully"
    });
  } catch (err) {
    console.error("❌ Reject guide error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};