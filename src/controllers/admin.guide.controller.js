import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";

// GET all guides with document counts and status
export const getAllGuides = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT tg.guide_id, tg.full_name, u.email, tg.approved, u.status,
        (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id) AS document_count,
        (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id AND gd.verified = false) AS pending_documents_count
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      ORDER BY tg.guide_id DESC
    `);
    res.json({ success: true, guides: result.rows });
  } catch (err) {
    console.error("[ADMIN] getAllGuides error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch guides" });
  }
};

// GET all guides with complete details including documents
export const getAllGuidesWithDocuments = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT 
        tg.guide_id, 
        tg.full_name, 
        tg.contact_number,
        tg.approved, 
        u.email, 
        u.status,
        u.user_id,
        u.created_at,
        (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id) AS document_count,
        (SELECT COUNT(*) FROM guide_documents gd WHERE gd.guide_id = tg.guide_id AND gd.verified = false) AS pending_documents_count
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id`;
    
    const params = [];
    if (status) {
      query += ` WHERE u.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY tg.guide_id DESC`;
    
    const result = await db.query(query, params);
    res.json({ success: true, guides: result.rows });
  } catch (err) {
    console.error("[ADMIN] getAllGuidesWithDocuments error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch guides" });
  }
};

// GET guide by ID with all documents
export const getGuideById = async (req, res) => {
  try {
    const { guideId } = req.params;
    const guideResult = await db.query(
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
        u.user_id,
        u.created_at,
        approved_by_user.email as approved_by_email,
        rejected_by_user.email as rejected_by_email
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       LEFT JOIN users approved_by_user ON tg.approved_by = approved_by_user.user_id
       LEFT JOIN users rejected_by_user ON tg.rejected_by = rejected_by_user.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );
    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide not found" });
    }
    const guide = guideResult.rows[0];
    
    // Add fields that don't exist in schema as null
    guide.languages = null;
    guide.experience_years = null;
    guide.license_number = null;
    
    const docsResult = await db.query(
      `SELECT document_id, document_type, verified, document_url, uploaded_at
       FROM guide_documents WHERE guide_id = $1
       ORDER BY uploaded_at DESC`,
      [guideId]
    );
    guide.documents = docsResult.rows;
    res.json({ success: true, guide });
  } catch (err) {
    console.error("[ADMIN] getGuideById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch guide" });
  }
};

// Approve a document
export const approveDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const update = await db.query(
      `UPDATE guide_documents SET verified = true WHERE document_id = $1 RETURNING guide_id`,
      [documentId]
    );
    if (update.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    res.json({ success: true, message: "Document approved" });
  } catch (err) {
    console.error("[ADMIN] approveDocument error:", err);
    res.status(500).json({ success: false, message: "Failed to approve document" });
  }
};

// Reject a document (mark as not verified)
export const rejectDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const update = await db.query(
      `UPDATE guide_documents SET verified = false WHERE document_id = $1 RETURNING guide_id`,
      [documentId]
    );
    if (update.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    res.json({ success: true, message: "Document rejected" });
  } catch (err) {
    console.error("[ADMIN] rejectDocument error:", err);
    res.status(500).json({ success: false, message: "Failed to reject document" });
  }
};

// Approve a guide (only if all documents are verified)
export const approveGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    // Check all documents are verified
    const docCheck = await db.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE verified) AS verified_count
       FROM guide_documents WHERE guide_id = $1`,
      [guideId]
    );
    if (docCheck.rows[0].total === "0") {
      return res.status(400).json({ success: false, message: "No documents uploaded" });
    }
    if (docCheck.rows[0].total !== docCheck.rows[0].verified_count) {
      return res.status(400).json({ success: false, message: "All documents must be verified before approval" });
    }
    await db.query(`UPDATE tour_guide SET approved = true WHERE guide_id = $1`, [guideId]);
    await db.query(
      `UPDATE users SET status = 'active' WHERE user_id = (SELECT user_id FROM tour_guide WHERE guide_id = $1)`,
      [guideId]
    );
    res.json({ success: true, message: "Guide approved and activated" });
  } catch (err) {
    console.error("[ADMIN] approveGuide error:", err);
    res.status(500).json({ success: false, message: "Failed to approve guide" });
  }
};

// Reject a guide (block user)
export const rejectGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    await db.query(
      `UPDATE users SET status = 'blocked' WHERE user_id = (SELECT user_id FROM tour_guide WHERE guide_id = $1)`,
      [guideId]
    );
    res.json({ success: true, message: "Guide rejected and blocked" });
  } catch (err) {
    console.error("[ADMIN] rejectGuide error:", err);
    res.status(500).json({ success: false, message: "Failed to reject guide" });
  }
};

// NEW: Approve guide with email notification
export const approveGuideAction = async (req, res) => {
  try {
    const { guideId } = req.params;
    
    // Get guide details
    const guideResult = await db.query(
      `SELECT tg.guide_id, tg.full_name, u.email, u.user_id
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );
    
    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide not found" });
    }
    
    const guide = guideResult.rows[0];
    
    // Check if guide has uploaded documents
    const docCheck = await db.query(
      `SELECT COUNT(*) AS total FROM guide_documents WHERE guide_id = $1`,
      [guideId]
    );
    
    if (parseInt(docCheck.rows[0].total) === 0) {
      return res.status(400).json({ success: false, message: "Guide must upload documents before approval" });
    }
    
    // Update guide approval status with timestamp and admin info
    await db.query(
      `UPDATE tour_guide 
       SET approved = true, 
           approved_at = NOW(), 
           approved_by = $1,
           rejection_reason = NULL,
           rejected_at = NULL,
           rejected_by = NULL
       WHERE guide_id = $2`,
      [req.user.user_id, guideId]
    );
    
    // Update user status to active
    await db.query(
      `UPDATE users SET status = 'active' WHERE user_id = $1`,
      [guide.user_id]
    );
    
    // Send approval email (don't block on email failure)
    try {
      const emailData = emailTemplates.guideApproved(guide.full_name);
      await sendEmail(guide.email, emailData.subject, emailData.html);
    } catch (emailError) {
      console.error("[ADMIN] Failed to send approval email:", emailError);
      // Continue anyway - guide is still approved
    }
    
    res.json({ success: true, message: "Guide approved successfully" });
  } catch (err) {
    console.error("[ADMIN] approveGuideAction error:", err);
    res.status(500).json({ success: false, message: "Failed to approve guide" });
  }
};

// NEW: Reject guide with reason and email notification
export const rejectGuideAction = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { reason } = req.body;
    
    console.log("[ADMIN] rejectGuideAction called with guideId:", guideId);
    console.log("[ADMIN] Request body:", req.body);
    console.log("[ADMIN] Reason:", reason);
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Rejection reason is required" });
    }
    
    // Get guide details
    const guideResult = await db.query(
      `SELECT tg.guide_id, tg.full_name, u.email, u.user_id
       FROM tour_guide tg
       JOIN users u ON tg.user_id = u.user_id
       WHERE tg.guide_id = $1`,
      [guideId]
    );
    
    if (guideResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Guide not found" });
    }
    
    const guide = guideResult.rows[0];
    
    // Update guide with rejection info
    await db.query(
      `UPDATE tour_guide 
       SET approved = false,
           rejection_reason = $1,
           rejected_at = NOW(),
           rejected_by = $2
       WHERE guide_id = $3`,
      [reason, req.user.user_id, guideId]
    );
    
    // Update user status to rejected
    await db.query(
      `UPDATE users SET status = 'rejected' WHERE user_id = $1`,
      [guide.user_id]
    );
    
    // Send rejection email (don't block on email failure)
    try {
      const emailData = emailTemplates.guideRejected(guide.full_name, reason);
      await sendEmail(guide.email, emailData.subject, emailData.html);
    } catch (emailError) {
      console.error("[ADMIN] Failed to send rejection email:", emailError);
      // Continue anyway - guide is still rejected
    }
    
    res.json({ success: true, message: "Guide rejected successfully" });
  } catch (err) {
    console.error("[ADMIN] rejectGuideAction error:", err);
    res.status(500).json({ success: false, message: "Failed to reject guide" });
  }
};

// GET approved guides only (for assignment dropdown)
export const getApprovedGuides = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        tg.guide_id, 
        tg.full_name, 
        tg.contact_number,
        u.email,
        tg.approved,
        u.status,
        (SELECT COUNT(*) FROM bookings WHERE guide_id = tg.guide_id AND status IN ('confirmed', 'pending')) AS active_tours_count
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      WHERE tg.approved = true 
        AND u.status = 'active'
      ORDER BY tg.full_name ASC
    `);
    
    res.json({ 
      success: true, 
      guides: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error("[ADMIN] getApprovedGuides error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch approved guides" 
    });
  }
};
