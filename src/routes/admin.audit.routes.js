import express from "express";
import db from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * GET /api/admin/audit-logs
 * Fetch all administrative audit logs with filtering and pagination
 */
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { 
      actionType, 
      targetType, 
      adminId, 
      dateFrom, 
      dateTo,
      page = 1,
      limit = 50 
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Base components of the query
    const selectColumns = `
      l.*,
      u.email as admin_email,
      u.role as admin_role,
      CASE 
        WHEN u.role = 'admin' THEN 'System Administrator'
        ELSE 'Staff'
      END as admin_name
    `;

    const fromAndWhere = `
      FROM audit_logs l
      LEFT JOIN users u ON l.admin_id = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    let filters = "";

    if (actionType) {
      filters += ` AND l.action_type = $${paramIndex++}`;
      params.push(actionType);
    }

    if (targetType) {
      filters += ` AND l.target_type = $${paramIndex++}`;
      params.push(targetType);
    }

    if (adminId) {
      filters += ` AND l.admin_id = $${paramIndex++}`;
      params.push(adminId);
    }

    if (dateFrom) {
      filters += ` AND l.created_at >= $${paramIndex++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      filters += ` AND l.created_at <= $${paramIndex++}`;
      params.push(dateTo);
    }

    // Get Total Count for pagination
    const countQuery = `SELECT COUNT(*) ${fromAndWhere} ${filters}`;
    const totalCount = await db.query(countQuery, params);

    // Final query with ordering and limit
    const dataQuery = `
      SELECT ${selectColumns} 
      ${fromAndWhere} 
      ${filters} 
      ORDER BY l.created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const queryParams = [...params, parseInt(limit), parseInt(offset)];
    const result = await db.query(dataQuery, queryParams);

    res.json({
      success: true,
      logs: result.rows,
      pagination: {
        total: parseInt(totalCount.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error("[AdminAudit] GET logs error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
});

export default router;
