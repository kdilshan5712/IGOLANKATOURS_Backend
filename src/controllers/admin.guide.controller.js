import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";
import { recordAuditLog } from "../utils/auditLogger.js";

/**
 * Retrieves all tour guides with their document counts and current status.
 * 
 * @async
 * @function getAllGuides
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of guides.
 */
export const getAllGuides = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT tg.guide_id, tg.full_name, u.email, tg.approved, u.status, tg.commission_rate,
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

/**
 * Fetches all guides with summary verification status, filtered by user status if provided.
 * 
 * @async
 * @function getAllGuidesWithDocuments
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.status] - Status filter for the guides.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with guide summaries.
 */
export const getAllGuidesWithDocuments = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT 
        tg.guide_id, 
        tg.full_name, 
        tg.contact_number,
        tg.approved,
        tg.commission_rate,
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

/**
 * Retrieves detailed information for a specific guide, including all uploaded documents
 * and approval/rejection history.
 * 
 * @async
 * @function getGuideById
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to fetch.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with comprehensive guide details.
 */
export const getGuideById = async (req, res) => {
  try {
    const { guideId } = req.params;
    const guideResult = await db.query(
      `SELECT 
        tg.guide_id, 
        tg.full_name, 
        tg.contact_number,
        tg.approved,
        tg.commission_rate,
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

/**
 * Marks a specific guide document as verified.
 * 
 * @async
 * @function approveDocument
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.documentId - ID of the document to verify.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming document approval.
 */
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

/**
 * Rejects a specific guide document by marking it as not verified.
 * 
 * @async
 * @function rejectDocument
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.documentId - ID of the document to reject.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming document rejection.
 */
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

/**
 * Approves a guide application and activates the user account, provided all documents are verified.
 * 
 * @async
 * @function approveGuide
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to approve.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide approval.
 */
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

/**
 * Rejects a guide application and blocks the corresponding user account.
 * 
 * @async
 * @function rejectGuide
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to reject.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide rejection.
 */
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

/**
 * Approves a guide with additional actions: timestamping, recording admin info,
 * sending an email notification, and logging the action.
 * 
 * @async
 * @function approveGuideAction
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to approve.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide approval.
 */
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
      const { sendGuideApproval } = await import("../utils/emailService.js");
      await sendGuideApproval(guide.email, guide.full_name);
    } catch (emailError) {
      console.error("[ADMIN] Failed to send approval email:", emailError);
      // Continue anyway - guide is still approved
    }

    // RECORD AUDIT LOG
    await recordAuditLog(req, {
      actionType: 'APPROVE_GUIDE',
      targetType: 'GUIDE',
      targetId: guideId,
      changes: { status: 'active', approved: true },
      description: `Approved and activated tour guide: ${guide.full_name}`
    });

    res.json({ success: true, message: "Guide approved successfully" });
  } catch (err) {
    console.error("[ADMIN] approveGuideAction error:", err);
    res.status(500).json({ success: false, message: "Failed to approve guide" });
  }
};

/**
 * Rejects a guide with a mandatory reason, blocks the user, sends a rejection email,
 * and records the action in the audit log.
 * 
 * @async
 * @function rejectGuideAction
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide to reject.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.reason - Mandatory reason for rejection.
 * @param {Object} req.user - Authenticated admin user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming guide rejection.
 */
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
      const { sendGuideRejection } = await import("../utils/emailService.js");
      await sendGuideRejection(guide.email, guide.full_name, reason);
    } catch (emailError) {
      console.error("[ADMIN] Failed to send rejection email:", emailError);
      // Continue anyway - guide is still rejected
    }

    // RECORD AUDIT LOG
    await recordAuditLog(req, {
      actionType: 'REJECT_GUIDE',
      targetType: 'GUIDE',
      targetId: guideId,
      changes: { status: 'rejected', approved: false, reason: reason },
      description: `Rejected tour guide: ${guide.full_name}. Reason: ${reason}`
    });

    res.json({ success: true, message: "Guide rejected successfully" });
  } catch (err) {
    console.error("[ADMIN] rejectGuideAction error:", err);
    res.status(500).json({ success: false, message: "Failed to reject guide" });
  }
};

/**
 * Retrieves a list of all currently approved and active tour guides for assignment.
 * 
 * @async
 * @function getApprovedGuides
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with approved guides.
 */
export const getApprovedGuides = async (req, res) => {
  try {
    console.log("[ADMIN] getApprovedGuides called");
    const result = await db.query(`
      SELECT 
        tg.guide_id, 
        tg.full_name, 
        tg.contact_number,
        u.email,
        tg.approved,
        u.status
      FROM tour_guide tg
      JOIN users u ON tg.user_id = u.user_id
      WHERE tg.approved = true 
        AND u.status = 'active'
      ORDER BY tg.full_name ASC
    `);

    console.log(`[ADMIN] Found ${result.rows.length} approved guides`);
    res.json({
      success: true,
      guides: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error("[ADMIN] getApprovedGuides error:", err);
    console.error("[ADMIN] Error stack:", err.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approved guides",
      error: err.message
    });
  }
};

/**
 * Updates the commission rate for a specific guide and records the change in the audit log.
 * 
 * @async
 * @function updateGuideCommission
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.guideId - ID of the guide.
 * @param {Object} req.body - Request body.
 * @param {number} req.body.commissionRate - New commission rate (between 0 and 1).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated rate.
 */
export const updateGuideCommission = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { commissionRate } = req.body;

    if (commissionRate === undefined || commissionRate < 0 || commissionRate > 1) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid commission rate. Must be between 0 and 1." 
      });
    }

    // Fetch guide name for better description
    const guideNameRes = await db.query(`SELECT full_name, commission_rate FROM tour_guide WHERE guide_id = $1`, [guideId]);
    const oldRate = guideNameRes.rows[0]?.commission_rate;

    await db.query(
      `UPDATE tour_guide SET commission_rate = $1 WHERE guide_id = $2`,
      [commissionRate, guideId]
    );

    // RECORD AUDIT LOG
    await recordAuditLog(req, {
      actionType: 'UPDATE_GUIDE_COMMISSION',
      targetType: 'GUIDE',
      targetId: guideId,
      changes: { old_rate: oldRate, new_rate: commissionRate },
      description: `Updated commission rate for guide ${guideId} to ${commissionRate * 100}%`
    });

    res.json({ 
      success: true, 
      message: "Commission rate updated successfully",
      commission_rate: commissionRate
    });
  } catch (err) {
    console.error("[ADMIN] updateGuideCommission error:", err);
    res.status(500).json({ success: false, message: "Failed to update commission rate" });
  }
};
