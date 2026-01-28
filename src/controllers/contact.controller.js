/**
 * CONTACT FORM CONTROLLER
 * Handles contact form submissions and admin management
 */

import db from '../config/db.js';
import { sendEmail } from '../utils/sendEmail.js';
import { emailTemplates } from '../utils/sendEmail.js';

/**
 * 1️⃣ PUBLIC: SUBMIT CONTACT MESSAGE
 * POST /api/contact
 * Body: { name, email, phone, subject, message }
 * No authentication required
 */
export const submitContactMessage = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate inputs
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be at least 2 characters"
      });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: "Valid email address is required"
      });
    }

    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Subject is required and must be at least 3 characters"
      });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 10 characters long"
      });
    }

    // Insert contact message
    const result = await db.query(`
      INSERT INTO contact_messages (name, email, phone, subject, message, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'new', NOW())
      RETURNING message_id, name, email, subject, created_at
    `, [
      name.trim(),
      email.toLowerCase().trim(),
      phone ? phone.trim() : null,
      subject.trim(),
      message.trim()
    ]);

    const contactMessage = result.rows[0];

    // Send confirmation email to user (non-blocking)
    try {
      const userEmailContent = emailTemplates.contactConfirmation(name);
      await sendEmail(email, "We received your message", userEmailContent);
    } catch (emailErr) {
      console.log("Error sending user confirmation email (non-blocking):", emailErr.message);
    }

    // Send admin notification email (non-blocking)
    try {
      // Get admin email from database
      const adminResult = await db.query(`
        SELECT u.email FROM users u 
        WHERE u.role = 'admin' 
        LIMIT 1
      `);

      if (adminResult.rows.length > 0) {
        const adminEmail = adminResult.rows[0].email;
        const adminEmailContent = emailTemplates.newContactMessage(name, email, subject, message);
        await sendEmail(adminEmail, `New Contact Message from ${name}`, adminEmailContent);
      }
    } catch (emailErr) {
      console.log("Error sending admin notification email (non-blocking):", emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Thank you for contacting us! We will get back to you shortly.",
      contactMessage
    });

  } catch (err) {
    console.error("submitContactMessage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit contact message",
      error: err.message
    });
  }
};

/**
 * 2️⃣ ADMIN: GET ALL CONTACT MESSAGES
 * GET /api/admin/contacts?status=new&limit=50&offset=0
 */
export const getContactMessages = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    // Build query based on status filter using parameterized queries
    let query = `
      SELECT 
        m.message_id,
        m.name,
        m.email,
        m.phone,
        m.subject,
        m.message,
        m.status,
        m.created_at,
        m.read_at,
        m.read_by,
        m.notes
      FROM contact_messages m
    `;

    const params = [limit, offset];

    if (status && status !== 'all') {
      query += ` WHERE m.status = $3`;
      params.splice(2, 0, status);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $1 OFFSET $2`;

    const result = await db.query(query, params);

    // Get counts by status
    const countResult = await db.query(`
      SELECT status, COUNT(*) as count FROM contact_messages GROUP BY status
    `);

    const statusCounts = {};
    countResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });

    res.json({
      success: true,
      count: result.rows.length,
      statusCounts,
      messages: result.rows
    });

  } catch (err) {
    console.error("getContactMessages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact messages",
      error: err.message
    });
  }
};

/**
 * 3️⃣ ADMIN: GET SINGLE CONTACT MESSAGE
 * GET /api/admin/contacts/:messageId
 */
export const getContactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const adminId = req.user.user_id;

    // Validate messageId
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required"
      });
    }

    // Get message
    const result = await db.query(`
      SELECT * FROM contact_messages WHERE message_id = $1
    `, [messageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const message = result.rows[0];

    // Mark as read if not already read
    if (message.status === 'new') {
      await db.query(`
        UPDATE contact_messages 
        SET status = 'read', read_by = $1, read_at = NOW()
        WHERE message_id = $2
      `, [adminId, messageId]);

      message.status = 'read';
      message.read_by = adminId;
      message.read_at = new Date();
    }

    res.json({
      success: true,
      message: message
    });

  } catch (err) {
    console.error("getContactMessage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact message",
      error: err.message
    });
  }
};

/**
 * 4️⃣ ADMIN: UPDATE CONTACT MESSAGE STATUS
 * PATCH /api/admin/contacts/:messageId
 * Body: { status, notes }
 */
export const updateContactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user.user_id;

    // Validate messageId
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required"
      });
    }

    // Validate status
    const validStatuses = ['new', 'read', 'responded', 'archived'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if message exists
    const messageCheck = await db.query(
      'SELECT * FROM contact_messages WHERE message_id = $1',
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Update message
    const updateQuery = `
      UPDATE contact_messages 
      SET 
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        read_by = CASE WHEN $1 = 'read' THEN $3 ELSE read_by END,
        read_at = CASE WHEN $1 = 'read' THEN NOW() ELSE read_at END
      WHERE message_id = $4
      RETURNING *
    `;

    const result = await db.query(updateQuery, [
      status || null,
      notes || null,
      adminId,
      messageId
    ]);

    res.json({
      success: true,
      message: "Contact message updated successfully",
      contactMessage: result.rows[0]
    });

  } catch (err) {
    console.error("updateContactMessage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update contact message",
      error: err.message
    });
  }
};

/**
 * 5️⃣ ADMIN: DELETE CONTACT MESSAGE
 * DELETE /api/admin/contacts/:messageId
 */
export const deleteContactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    // Validate messageId
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required"
      });
    }

    // Delete message
    const result = await db.query(
      'DELETE FROM contact_messages WHERE message_id = $1 RETURNING *',
      [messageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    res.json({
      success: true,
      message: "Contact message deleted successfully"
    });

  } catch (err) {
    console.error("deleteContactMessage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact message",
      error: err.message
    });
  }
};

/**
 * 6️⃣ ADMIN: MARK MESSAGE AS READ (SHORTCUT)
 * PATCH /api/admin/contacts/:messageId/read
 */
export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const adminId = req.user.user_id;

    // Check if message exists
    const messageCheck = await db.query(
      'SELECT * FROM contact_messages WHERE message_id = $1',
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Update to read
    const result = await db.query(`
      UPDATE contact_messages 
      SET status = 'read', read_by = $1, read_at = NOW()
      WHERE message_id = $2
      RETURNING *
    `, [adminId, messageId]);

    res.json({
      success: true,
      message: "Message marked as read",
      contactMessage: result.rows[0]
    });

  } catch (err) {
    console.error("markMessageAsRead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark message as read",
      error: err.message
    });
  }
};
