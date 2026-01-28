import db from "../config/db.js";

/* ======================================================
   GET ALL GUIDE DOCUMENTS (ADMIN)
   ====================================================== */
export const getAllGuideDocuments = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         gd.document_id,
         gd.guide_id,
         gd.document_type,
         gd.document_url,
         gd.verified,
         gd.uploaded_at,
         tg.full_name as guide_name,
         u.email as guide_email
       FROM guide_documents gd
       JOIN tour_guide tg ON gd.guide_id = tg.guide_id
       JOIN users u ON tg.user_id = u.user_id
       ORDER BY gd.uploaded_at DESC`
    );

    res.json({
      success: true,
      count: result.rows.length,
      documents: result.rows
    });
  } catch (err) {
    console.error("Admin getAllGuideDocuments error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch documents" 
    });
  }
};

/* ======================================================
   VERIFY GUIDE DOCUMENT (ADMIN)
   ====================================================== */
export const verifyDocument = async (req, res) => {
  try {
    const { document_id } = req.params;
    const adminUserId = req.user.user_id;

    // Update document to verified
    await db.query(
      `UPDATE guide_documents
       SET verified = true, 
           verified_by = $1, 
           verified_at = NOW()
       WHERE document_id = $2`,
      [adminUserId, document_id]
    );

    // Get guide_id for this document
    const docResult = await db.query(
      `SELECT guide_id FROM guide_documents WHERE document_id = $1`,
      [document_id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Document not found" 
      });
    }

    const guideId = docResult.rows[0].guide_id;

    // Check if ALL documents for this guide are verified
    const allDocsResult = await db.query(
      `SELECT COUNT(*) as total, 
              COUNT(*) FILTER (WHERE verified = true) as verified_count
       FROM guide_documents
       WHERE guide_id = $1`,
      [guideId]
    );

    const { total, verified_count } = allDocsResult.rows[0];

    // If all documents are verified, approve the guide
    if (parseInt(total) > 0 && parseInt(total) === parseInt(verified_count)) {
      await db.query(
        `UPDATE tour_guide
         SET approved = true, 
             approved_by = $1, 
             approved_at = NOW()
         WHERE guide_id = $2`,
        [adminUserId, guideId]
      );

      await db.query(
        `UPDATE users
         SET status = 'active'
         WHERE user_id = (SELECT user_id FROM tour_guide WHERE guide_id = $1)`,
        [guideId]
      );
    }

    res.json({ 
      success: true,
      message: "Document verified successfully",
      guide_fully_approved: parseInt(total) === parseInt(verified_count)
    });
  } catch (err) {
    console.error("Admin verifyDocument error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to verify document" 
    });
  }
};

/* ======================================================
   REJECT GUIDE DOCUMENT (ADMIN)
   ====================================================== */
export const rejectDocument = async (req, res) => {
  try {
    const { document_id } = req.params;
    const adminUserId = req.user.user_id;

    // Update document to not verified (keep file in storage)
    const result = await db.query(
      `UPDATE guide_documents
       SET verified = false, 
           verified_by = $1, 
           verified_at = NOW()
       WHERE document_id = $2
       RETURNING guide_id`,
      [adminUserId, document_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Document not found" 
      });
    }

    res.json({ 
      success: true,
      message: "Document rejected successfully"
    });
  } catch (err) {
    console.error("Admin rejectDocument error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to reject document" 
    });
  }
};
