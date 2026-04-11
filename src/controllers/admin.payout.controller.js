import db from "../config/db.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";
import { recordAuditLog } from "../utils/auditLogger.js";

/* ======================================================
   GET ALL PAYOUT REQUESTS
   GET /api/admin/payouts
   ====================================================== */
export const getAllPayoutRequests = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        pr.*,
        tg.full_name as guide_name,
        tg.bank_name,
        tg.account_no,
        tg.account_name,
        tg.branch_name,
        u.email as guide_email,
        ap.email as processor_email
      FROM payout_requests pr
      JOIN tour_guide tg ON pr.guide_id = tg.guide_id
      JOIN users u ON tg.user_id = u.user_id
      LEFT JOIN users ap ON pr.processed_by = ap.user_id
    `;
    
    const params = [];
    if (status) {
      query += ` WHERE pr.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY pr.requested_at DESC`;
    
    const result = await db.query(query, params);
    
    // Fetch status counts
    const countResult = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM payout_requests 
      GROUP BY status
    `);
    
    const statusCounts = {
      pending: 0,
      approved: 0,
      paid: 0,
      rejected: 0
    };
    
    countResult.rows.forEach(row => {
      if (statusCounts.hasOwnProperty(row.status)) {
        statusCounts[row.status] = parseInt(row.count);
      }
    });
    
    res.json({
      success: true,
      count: result.rows.length,
      payouts: result.rows,
      statusCounts
    });
  } catch (err) {
    console.error("❌ getAllPayoutRequests error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch payout requests" });
  }
};

/* ======================================================
   UPDATE PAYOUT STATUS (Approve/Reject/Paid)
   PATCH /api/admin/payouts/:id/status
   ====================================================== */
export const updatePayoutStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    const adminId = req.user.user_id;

    if (!['approved', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid payout status" });
    }

    // 1. Get payout and guide info
    const payoutResult = await db.query(
      `SELECT pr.*, u.email as guide_email, tg.full_name as guide_name
       FROM payout_requests pr
       JOIN tour_guide tg ON pr.guide_id = tg.guide_id
       JOIN users u ON tg.user_id = u.user_id
       WHERE pr.payout_id = $1`,
      [id]
    );

    if (payoutResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Payout request not found" });
    }

    const payout = payoutResult.rows[0];

    // 2. Update status
    const result = await db.query(
      `UPDATE payout_requests 
       SET 
         status = $1, 
         admin_notes = $2, 
         processed_at = NOW(), 
         processed_by = $3,
         updated_at = NOW()
       WHERE payout_id = $4
       RETURNING *`,
      [status, admin_notes, adminId, id]
    );

    // 3. Notify guide via email (if possible)
    // Here we could add a new email template for payouts
    // For now, let's just log it.
    console.log(`[PAYOUT] Request ${id} updated to ${status} by admin ${adminId}`);

    // RECORD AUDIT LOG
    await recordAuditLog(req, {
      actionType: 'UPDATE_PAYOUT_STATUS',
      targetType: 'PAYOUT_REQUEST',
      targetId: id,
      changes: {
        old_status: payout.status,
        new_status: status,
        admin_notes: admin_notes
      },
      description: `Payout request for ${payout.guide_name} (${payout.amount}) marked as ${status}`
    });

    res.json({
      success: true,
      message: `Payout request marked as ${status}`,
      payout: result.rows[0]
    });
  } catch (err) {
    console.error("❌ updatePayoutStatus error:", err);
    res.status(500).json({ success: false, message: "Failed to update payout status" });
  }
};
