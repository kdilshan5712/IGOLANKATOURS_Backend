import db from "../config/db.js";

/**
 * Audit Logger Utility
 * Handles the recording of administrative actions for security tracking and accountability.
 */

/**
 * Records a detailed administrative action into the audit_logs table.
 * Extracts administrative metadata from the request object and persists the transformation details.
 * 
 * @async
 * @function recordAuditLog
 * @param {Object} req - Express request object used to extract admin_id and IP address.
 * @param {Object} params - The data parameters for the audit log.
 * @param {string} params.actionType - The category of action performed (e.g., 'UPDATE_BOOKING_STATUS').
 * @param {string} params.targetType - The type of entity affected by the action (e.g., 'BOOKING').
 * @param {string} params.targetId - The specific ID of the resource being modified.
 * @param {Object} [params.changes] - An optional object describing the specific data changes (old vs new).
 * @param {string} [params.description] - A human-readable description of the action.
 * @returns {Promise<void>} Resolves when the log is recorded. Does not throw errors to prevent blocking the main request flow.
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
