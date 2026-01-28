/* ======================================================
   ADMIN: GET ALL GUIDE DOCUMENTS
   ====================================================== */
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

/* ======================================================
   ADMIN: GET ALL GUIDES WITH DOCUMENTS (FOR DASHBOARD)
   Query params: status=pending|approved|rejected
   ====================================================== */
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

/* ======================================================
   ADMIN: APPROVE GUIDE DOCUMENT
   ====================================================== */
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

/* ======================================================
   ADMIN: REJECT GUIDE DOCUMENT
   ====================================================== */
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

/* ======================================================
   GET DOCUMENT URL - Generate Supabase public URL
   ====================================================== */
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

/* ======================================================
   GET ALL PENDING GUIDES
   ====================================================== */
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

/* ======================================================
   GET DOCUMENTS FOR A GUIDE
   ====================================================== */
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

/* ======================================================
   APPROVE GUIDE
   ====================================================== */
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

/* ======================================================
   REJECT GUIDE
   ====================================================== */
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

/* ======================================================
   GET ALL GUIDES (WITH ENHANCED FIELDS)
   ====================================================== */
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

/* ======================================================
   GET GUIDE DETAILS (ENHANCED)
   ====================================================== */
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

/* ======================================================
   GET PENDING GUIDE APPLICATIONS (USING VIEW)
   ====================================================== */
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

/* ======================================================
   GET APPROVED GUIDES (USING VIEW)
   ====================================================== */
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
/* ======================================================
   ADMIN: APPROVE GUIDE (DASHBOARD)
   PATCH /api/admin/guides/:guideId/approve
   ====================================================== */
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

/* ======================================================
   ADMIN: REJECT GUIDE (DASHBOARD)
   PATCH /api/admin/guides/:guideId/reject
   ====================================================== */
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