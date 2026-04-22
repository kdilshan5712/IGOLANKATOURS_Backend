import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { emailWrapper } from './emailTemplates.js';

/**
 * Email Service
 * Provides high-level methods for sending transactional emails using Nodemailer.
 * Handles template loading, placeholder replacement, and email logging.
 */

// Create reusable transporter
const createTransporter = () => {
    const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.error('❌ SMTP credentials missing! EMAIL_USER or EMAIL_PASS not set.');
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
};

// Build a safe 'from' address — avoids angle-bracket corruption in Azure env vars
const getFromAddress = () => {
    // Use BRANDED email if provided (best for delivery/spam filters)
    if (process.env.EMAIL_FROM) {
        return process.env.EMAIL_FROM;
    }

    // Fallback: Build from components
    const name = process.env.EMAIL_FROM_NAME || 'I GO LANKA TOURS';
    const user = process.env.EMAIL_USER || 'tours.igolanka@gmail.com';
    return `${name} <${user}>`;
};


/**
 * Loads an HTML email template from the file system and replaces curly-brace placeholders 
 * with provided dynamic values.
 * 
 * @function loadTemplate
 * @param {string} templateName - The filename of the template (without .html extension).
 * @param {Object} replacements - Key-value pairs for placeholder replacement.
 * @returns {string|null} The processed HTML string or null if loading fails.
 */
export const loadTemplate = (templateName, replacements) => {
    try {
        const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
        let template = fs.readFileSync(templatePath, 'utf8');

        // Replace all placeholders
        Object.keys(replacements).forEach(key => {
            const placeholder = `{{${key}}}`;
            template = template.replace(new RegExp(placeholder, 'g'), replacements[key]);
        });

        return template;
    } catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        return null;
    }
};

/**
 * Log email sending attempt
 */
const logEmail = async (to, subject, status, errorMessage = null) => {
    try {
        await pool.query(
            `INSERT INTO email_logs (recipient, subject, status, error_message)
       VALUES ($1, $2, $3, $4)`,
            [to, subject, status, errorMessage]
        );
    } catch (error) {
        console.error('Error logging email:', error);
    }
};

/**
 * Sends a raw email using the configured SMTP transporter.
 * Wraps content in a standard layout if it's not a full HTML document.
 * 
 * @async
 * @function sendEmail
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlContent - Main HTML body of the email.
 * @param {string} [textContent=''] - Plain text alternative (auto-generated if omitted).
 * @returns {Promise<Object>} An object indicating success and the Stripe messageId.
 */
export const sendEmail = async (to, subject, htmlContent, textContent = '') => {
    try {
        const transporter = createTransporter();

        const isFullHtml = htmlContent.includes("<!DOCTYPE html>") || htmlContent.includes("<html");

        const mailOptions = {
            from: getFromAddress(),
            to,
            subject,
            html: isFullHtml ? htmlContent : emailWrapper(htmlContent),
            text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);

        await logEmail(to, subject, 'sent');

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('❌ Error sending email to', to, ':', error.message);
        console.error('   SMTP Host:', process.env.EMAIL_HOST);
        console.error('   SMTP User:', process.env.EMAIL_USER);
        console.error('   From:', getFromAddress());
        await logEmail(to, subject, 'failed', error.message);

        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Sends a branded booking confirmation email to a tourist.
 * 
 * @async
 * @function sendBookingConfirmation
 * @param {Object} bookingData - Metadata for the booking.
 * @param {string} bookingData.userEmail - Tourist's email.
 * @param {string} bookingData.userName - Tourist's full name.
 * @param {string} bookingData.bookingReference - Unique reference code for the booking.
 * @param {string} bookingData.packageName - Name of the tour package.
 * @param {string|Date} bookingData.travelDate - Scheduled travel date.
 * @param {number} bookingData.totalPrice - Total cost of the booking.
 * @param {number} bookingData.numberOfTravelers - Number of people in the group.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendBookingConfirmation = async (bookingData) => {
    const { userEmail, userName, bookingReference, packageName, travelDate, totalPrice, numberOfTravelers } = bookingData;

    const htmlContent = loadTemplate('bookingConfirmation', {
        userName,
        bookingReference,
        packageName,
        travelDate: new Date(travelDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        totalPrice: `$${totalPrice}`,
        numberOfTravelers
    });

    if (!htmlContent) {
        console.error('Failed to load booking confirmation template');
        return { success: false };
    }

    return await sendEmail(
        userEmail,
        `Booking Confirmation - ${bookingReference}`,
        htmlContent
    );
};

/**
 * Sends a notification email to a tour guide when they are assigned to a booking.
 * 
 * @async
 * @function sendGuideAssignment
 * @param {Object} assignmentData - Data related to the assignment.
 * @param {string} assignmentData.guideEmail - Guide's email.
 * @param {string} assignmentData.guideName - Guide's full name.
 * @param {string} assignmentData.bookingReference - Reference code for the booking.
 * @param {string} assignmentData.packageName - Name of the tour package.
 * @param {string|Date} assignmentData.travelDate - Travel date.
 * @param {string} assignmentData.touristName - Name of the primary tourist.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendGuideAssignment = async (assignmentData) => {
    const { guideEmail, guideName, bookingReference, packageName, travelDate, touristName } = assignmentData;

    const htmlContent = loadTemplate('guideAssignment', {
        guideName,
        bookingReference,
        packageName,
        travelDate: new Date(travelDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        touristName
    });

    if (!htmlContent) {
        console.error('Failed to load guide assignment template');
        return { success: false };
    }

    return await sendEmail(
        guideEmail,
        `New Tour Assignment - ${bookingReference}`,
        htmlContent
    );
};

/**
 * Sends a booking cancellation notification to a tourist.
 * 
 * @async
 * @function sendCancellationEmail
 * @param {Object} cancellationData - Cancellation details.
 * @param {string} cancellationData.userEmail - Tourist's email.
 * @param {string} cancellationData.userName - Tourist's name.
 * @param {string} cancellationData.bookingReference - Reference for the cancelled booking.
 * @param {string} cancellationData.packageName - Name of the package.
 * @param {number} [cancellationData.refundAmount] - Amount being refunded, if any.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendCancellationEmail = async (cancellationData) => {
    const { userEmail, userName, bookingReference, packageName, refundAmount } = cancellationData;

    const htmlContent = loadTemplate('cancellation', {
        userName,
        bookingReference,
        packageName,
        refundAmount: refundAmount ? `$${refundAmount}` : '$0.00'
    });

    if (!htmlContent) {
        console.error('Failed to load cancellation template');
        return { success: false };
    }

    return await sendEmail(
        userEmail,
        `Booking Cancelled - ${bookingReference}`,
        htmlContent
    );
};

/**
 * Sends a password reset link to a user.
 * 
 * @async
 * @function sendPasswordReset
 * @param {string} email - Recipient's email.
 * @param {string} resetToken - Secure reset token.
 * @param {string} [userName='User'] - Name of the user.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendPasswordReset = async (email, resetToken, userName) => {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const htmlContent = loadTemplate('passwordReset', {
        userName: userName || 'User',
        resetLink
    });

    if (!htmlContent) {
        console.error('Failed to load password reset template');
        return { success: false };
    }

    return await sendEmail(
        email,
        'Password Reset Request - I Go Lanka Tours',
        htmlContent
    );
};

/**
 * Sends a welcome email to a newly registered user.
 * 
 * @async
 * @function sendWelcomeEmail
 * @param {string} email - Recipient's email.
 * @param {string} userName - User's full name.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendWelcomeEmail = async (email, userName) => {
    const htmlContent = loadTemplate('welcome', {
        userName,
        loginLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
    });

    if (!htmlContent) {
        console.error('Failed to load welcome template');
        return { success: false };
    }

    return await sendEmail(
        email,
        'Welcome to I Go Lanka Tours!',
        htmlContent
    );
};

/**
 * Sends an approval notification to a tour guide applicant.
 * 
 * @async
 * @function sendGuideApproval
 * @param {string} email - Guide's email.
 * @param {string} guideName - Guide's name.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendGuideApproval = async (email, guideName) => {
    const htmlContent = loadTemplate('guideApproval', {
        guideName,
        loginLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/guide/login`
    });

    if (!htmlContent) {
        console.error('Failed to load guide approval template');
        return { success: false };
    }

    return await sendEmail(
        email,
        'Guide Application Approved - I Go Lanka Tours',
        htmlContent
    );
};

/**
 * Sends a rejection notification to a tour guide applicant with a reason.
 * 
 * @async
 * @function sendGuideRejection
 * @param {string} email - Guide's email.
 * @param {string} guideName - Guide's name.
 * @param {string} [rejectionReason] - The reason for rejection.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendGuideRejection = async (email, guideName, rejectionReason) => {
    const htmlContent = loadTemplate('guideRejection', {
        guideName,
        rejectionReason: rejectionReason || 'Please contact support for more information.'
    });

    if (!htmlContent) {
        console.error('Failed to load guide rejection template');
        return { success: false };
    }

    return await sendEmail(
        email,
        'Guide Application Update - I Go Lanka Tours',
        htmlContent
    );
};

/**
 * Sends a balance payment reminder to a tourist.
 * 
 * @async
 * @function sendPaymentReminder
 * @param {Object} reminderData - Reminder details.
 * @param {string} reminderData.userEmail - Tourist's email.
 * @param {string} reminderData.userName - Tourist's name.
 * @param {string} reminderData.bookingReference - Booking reference.
 * @param {string} reminderData.packageName - Name of the package.
 * @param {string|Date} reminderData.travelDate - Planned travel date.
 * @param {number} reminderData.totalPrice - Total price of the trip.
 * @param {number} reminderData.amountPaid - Amount already paid.
 * @param {number} reminderData.balanceAmount - Outstanding balance.
 * @returns {Promise<Object>} The result of the send operation.
 */
export const sendPaymentReminder = async (reminderData) => {
    const { userEmail, userName, bookingReference, packageName, travelDate, totalPrice, amountPaid, balanceAmount } = reminderData;

    const htmlContent = loadTemplate('paymentReminder', {
        userName,
        bookingReference,
        packageName,
        travelDate: new Date(travelDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        totalPrice: `$${totalPrice}`,
        amountPaid: `$${amountPaid}`,
        balanceAmount: `$${balanceAmount}`,
        paymentLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/bookings/${bookingReference}`
    });

    if (!htmlContent) {
        console.error('Failed to load payment reminder template');
        return { success: false };
    }

    return await sendEmail(
        userEmail,
        `Payment Reminder: Your trip to ${packageName} - ${bookingReference}`,
        htmlContent
    );
};

const emailService = {
    sendEmail,
    sendBookingConfirmation,
    sendGuideAssignment,
    sendCancellationEmail,
    sendPasswordReset,
    sendWelcomeEmail,
    sendGuideApproval,
    sendGuideRejection,
    sendPaymentReminder
};

export default emailService;
