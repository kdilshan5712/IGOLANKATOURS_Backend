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
 * Handles all email sending functionality using Nodemailer
 */

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

/**
 * Load email template and replace placeholders
 */
/**
 * Load email template and replace placeholders
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
 * Core email sending function
 */
export const sendEmail = async (to, subject, htmlContent, textContent = '') => {
    try {
        const transporter = createTransporter();

        const isFullHtml = htmlContent.includes("<!DOCTYPE html>") || htmlContent.includes("<html");

        const mailOptions = {
            from: `"I Go Lanka Tours" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to,
            subject,
            html: isFullHtml ? htmlContent : emailWrapper(htmlContent),
            text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);

        await logEmail(to, subject, 'sent');

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        await logEmail(to, subject, 'failed', error.message);

        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send booking confirmation email
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
 * Send guide assignment notification
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
 * Send booking cancellation email
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
 * Send password reset email
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
 * Send welcome email to new user
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
 * Send guide approval notification
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
 * Send guide rejection notification
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
 * Send payment reminder email
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
