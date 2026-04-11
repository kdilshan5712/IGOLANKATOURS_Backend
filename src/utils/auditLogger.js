import db from "../config/db.js";

/**
 * Records an administrative action to the audit logs
 * 
 * @param {Object} req - Express request object (to extract admin_id and ip)
 * @param {Object} params - Log parameters
 * @param {string} params.actionType - Type of action (e.g., 'UPDATE_BOOKING_STATUS')
 * @param {string} params.targetType - Type of target (e.g., 'BOOKING')
 * @param {string} params.targetId - ID of the target resource
 * @param {Object} [params.changes] - JSON object containing old/new values
 * @param {string} [params.description] - Human readable description
 */
export const recordAuditLog = async (req, params) => {
  try {
    const { actionType, targetType, targetId, changes, description } = params;
    const adminId = req.user?.user_id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!adminId) {
      console.warn("[AuditLogger] No admin ID found in request. Log may be anonymous.");
    }

    await db.query(`
      INSERT INTO audit_logs (
        admin_id, action_type, target_type, target_id, 
        changes, description, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      adminId, 
      actionType, 
      targetType, 
      targetId, 
      changes ? JSON.stringify(changes) : null, 
      description, 
      ipAddress
    ]);

    console.log(`[Audit] ${actionType} recorded for ${targetType} ${targetId}`);
  } catch (err) {
    console.error("[AuditLogger] Critical Error recording log:", err);
    // We don't throw here to avoid breaking the main request flow if logging fails
  }
};
