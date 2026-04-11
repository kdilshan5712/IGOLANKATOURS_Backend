import nodemailer from "nodemailer";

/**
 * EMAIL UTILITY
 * Sends emails using NodeMailer
 * Fails silently to prevent blocking API responses
 */
import { emailWrapper } from "./emailTemplates.js";

// Validate email configuration
const isEmailConfigured = () => {
  return !!(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_FROM
  );
};

// Create reusable transporter
let transporter = null;

const getTransporter = () => {
  if (!isEmailConfigured()) {
    console.warn("⚠️  Email not configured. Emails will not be sent.");
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      logger: true,
      debug: true
    });
  }

  return transporter;
};

/**
 * Send email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<boolean>} - Success status
 */
export const sendEmail = async (to, subject, html) => {
  try {
    const transport = getTransporter();

    if (!transport) {
      console.warn("⚠️  Email not sent (not configured):", subject);
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    };

    await transport.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return false;
  }
};

/**
 * REUSABLE EMAIL TEMPLATES
 */

export const emailTemplates = {
  /**
   * Tourist Welcome Email
   */
  touristWelcome: (fullName) => ({
    subject: "Welcome to I GO LANKA TOURS! 🌴",
    html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Hello ${fullName}! 👋</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Welcome to Sri Lanka's premier travel platform! We're excited to have you join our community.</p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;"><strong>Your account is now active!</strong></p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">You can now:</p>
      <ul style="color: #374151; font-size: 16px; line-height: 1.6;">
        <li>Browse amazing tour packages</li>
        <li>Connect with verified tour guides</li>
        <li>Book unforgettable experiences in Sri Lanka</li>
        <li>Manage your travel itineraries</li>
      </ul>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Start exploring the beauty of Sri Lanka today!</p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #1e40af; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Start Exploring</a>
      </div>
    `)
  }),

  /**
   * Email Verification Email
   */
  emailVerification: (fullName, verificationLink) => ({
    subject: "Verify Your Email - I GO LANKA TOURS ✉️",
    html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Verify Your Email</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello ${fullName}! 👋</p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Thank you for registering with <strong>I GO LANKA TOURS</strong>!</p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="display: inline-block; background: #1e40af; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(30, 64, 175, 0.2);">Verify Email Address</a>
      </div>
      
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #1e40af;">⏰ Important:</strong> This verification link will expire in <strong>24 hours</strong>.
      </div>
      
      <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6; font-size: 12px; font-family: monospace;">${verificationLink}</p>
      
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #92400e;">⚠️ Security Notice:</strong> If you didn't create an account with I GO LANKA TOURS, please ignore this email.
      </div>
    `)
  }),

  /**
   * Password Reset Email
   */
  passwordReset: (fullName, resetLink) => ({
    subject: "Reset Your Password - I GO LANKA TOURS 🔐",
    html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Password Reset Request</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello ${fullName}! 👋</p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">We received a request to reset your password for your <strong>I GO LANKA TOURS</strong> account.</p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Click the button below to create a new password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="display: inline-block; background: #dc2626; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">Reset Password</a>
      </div>
      
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #92400e;">⏰ Important:</strong> This link will expire in <strong>1 hour</strong> for security reasons.
      </div>
      
      <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #dc2626; font-size: 12px; font-family: monospace;">${resetLink}</p>
      
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #991b1b;">⚠️ Security Alert:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
      </div>
    `)
  }),

  /**
   * Guide Registration Email
   */
  guideRegistration: (fullName) => ({
    subject: "Guide Registration Received - Next Steps 📋",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .step { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #f5576c; border-radius: 5px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧭 Guide Registration Received!</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName}! 👋</h2>
            <p>Thank you for registering as a tour guide with I GO LANKA TOURS!</p>
            
            <p><strong>Your registration has been received successfully.</strong></p>
            
            <h3>📋 Next Steps:</h3>
            
            <div class="step">
              <strong>Step 1: Upload Required Documents</strong>
              <p>Please upload the following verification documents:</p>
              <ul>
                <li>Tour Guide License</li>
                <li>Professional Certificates</li>
                <li>Government-issued ID Card</li>
              </ul>
            </div>
            
            <div class="step">
              <strong>Step 2: Admin Review</strong>
              <p>Our team will review your profile and documents within 2-3 business days.</p>
            </div>
            
            <div class="step">
              <strong>Step 3: Approval & Activation</strong>
              <p>Once approved, you'll receive an email confirmation and can start offering your services!</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> You cannot log in until your account is approved by our admin team.
            </div>
            
            <p>We're excited to have you join our network of professional guides!</p>
            
            <div class="footer">
              <p>Questions? Contact us at support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Guide Document Upload Confirmation
   */
  guideDocumentUpload: (fullName, documentType) => ({
    subject: "Document Received - Pending Verification ✅",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .document-box { background: white; padding: 20px; margin: 20px 0; border: 2px solid #4facfe; border-radius: 8px; text-align: center; }
          .info-box { background: #e7f3ff; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Document Received!</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName}! 👋</h2>
            <p>We've successfully received your document upload.</p>
            
            <div class="document-box">
              <h3>✅ Document Type: ${documentType.toUpperCase()}</h3>
              <p>Status: <strong>Pending Verification</strong></p>
            </div>
            
            <div class="info-box">
              <p><strong>What happens next?</strong></p>
              <p>Our admin team will review your document within 1-2 business days. You'll receive an email notification once your profile is approved or if additional information is needed.</p>
            </div>
            
            <p>Thank you for your patience! We're working to verify all guides to ensure the best experience for our tourists.</p>
            
            <div class="footer">
              <p>Need help? Contact support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Guide Approved Email
   */
  guideApproved: (fullName) => ({
    subject: "🎉 Congratulations! Your Guide Account is Approved!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d4edda; border: 2px solid #28a745; color: #155724; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
          .action-box { background: white; padding: 20px; margin: 20px 0; border: 2px solid #38ef7d; border-radius: 8px; }
          .button { display: inline-block; background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>You're Now an Approved Guide!</h2>
          </div>
          <div class="content">
            <h2>Hello ${fullName}! 👋</h2>
            
            <div class="success-box">
              <h3>✅ Your account has been approved!</h3>
              <p>You can now log in and start offering your tour guide services.</p>
            </div>
            
            <div class="action-box">
              <h3>🚀 Get Started:</h3>
              <ul>
                <li><strong>Log in to your account</strong> using your registered email</li>
                <li>Complete your profile with tour specialties and languages</li>
                <li>Set your availability and pricing</li>
                <li>Start receiving tour bookings!</li>
              </ul>
            </div>
            
            <p><strong>Welcome to our community of professional tour guides!</strong></p>
            <p>We're excited to have you showcase the beauty of Sri Lanka to travelers from around the world.</p>
            
            <div class="footer">
              <p>Need assistance? Contact support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Guide Rejected Email
   */
  guideRejected: (fullName, reason) => ({
    subject: "Guide Application Update - Action Required",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .reason-box { background: white; padding: 20px; margin: 20px 0; border: 2px solid #ff6b6b; border-radius: 8px; }
          .resubmit-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 24px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Application Status Update</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName},</h2>
            
            <p>Thank you for your interest in becoming a tour guide with I GO LANKA TOURS.</p>
            
            <div class="warning-box">
              <p><strong>Unfortunately, we're unable to approve your guide application at this time.</strong></p>
            </div>
            
            ${reason ? `
            <div class="reason-box">
              <h3>📝 Reason for Rejection:</h3>
              <p>${reason}</p>
            </div>
            ` : ''}
            
            <div class="resubmit-box">
              <h3>🔄 Want to Resubmit?</h3>
              <p>You can log in to your account and upload corrected documents:</p>
              <ol>
                <li>Log in at: <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/login">IGOLANKA Tours Login</a></li>
                <li>View your rejection reason</li>
                <li>Upload corrected documents</li>
                <li>Resubmit for review</li>
              </ol>
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/login" class="btn">
                  Log In to Resubmit
                </a>
              </p>
            </div>

            <h3>What happens next?</h3>
            <ul>
              <li>Your account remains active for resubmission</li>
              <li>You can upload corrected documents anytime</li>
              <li>Our team will review your resubmission within 2-3 business days</li>
              <li>You'll receive an email once reviewed</li>
            </ul>
            
            <p>If you have questions or need clarification, please contact our support team.</p>
            
            <div class="footer">
              <p><strong>I GO LANKA TOURS Support Team</strong></p>
              <p>Email: support@igolankatours.com | Phone: +94 XX XXX XXXX</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Review Submitted - Confirmation email to reviewer
   */
  reviewSubmitted: (fullName) => ({
    subject: "Thank You for Your Review! ⭐",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Thank You!</h1>
            <h2>Your Review Has Been Received</h2>
          </div>
          <div class="content">
            <h2>Hello ${fullName},</h2>
            
            <p>We truly appreciate you taking the time to share your feedback about our tour packages. Your review is invaluable to us!</p>
            
            <div class="info-box">
              <h3>📝 What happens next:</h3>
              <ul>
                <li>Our team will review your submission for quality and authenticity</li>
                <li>Once approved, your review will be published on our website</li>
                <li>Other travelers will benefit from your insights and experiences</li>
                <li>You'll receive a confirmation email once it's published</li>
              </ul>
            </div>
            
            <p>This helps us maintain the highest standards of credibility and customer satisfaction.</p>
            
            <p><strong>Have another experience to share?</strong> Feel free to submit more reviews anytime!</p>
            
            <div class="footer">
              <p>Questions? Contact us at support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Review Approved - Notification to reviewer
   */
  reviewApproved: (fullName) => ({
    subject: "Your Review Has Been Published! 🎉",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Approved!</h1>
            <h2>Your Review is Now Live</h2>
          </div>
          <div class="content">
            <h2>Hello ${fullName},</h2>
            
            <p>Great news! Your review has been approved and is now published on our website.</p>
            
            <div class="success-box">
              <h3>🌟 Your contribution is now visible to:</h3>
              <ul>
                <li>Potential travelers planning their Sri Lanka adventure</li>
                <li>Other customers reading reviews for the packages you reviewed</li>
                <li>Our tour guides who value authentic feedback</li>
              </ul>
            </div>
            
            <p>Thank you for helping other travelers make informed decisions and for supporting our community!</p>
            
            <p><strong>Would you like to share more experiences?</strong> Log in to your account to submit additional reviews.</p>
            
            <div class="footer">
              <p>Thank you for being part of our community!</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Review Rejected - Notification to reviewer with reason
   */
  reviewRejected: (fullName, reason) => ({
    subject: "Review Update - Please Review Our Guidelines",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .reason-box { background: white; padding: 20px; margin: 20px 0; border: 2px solid #ff9800; border-radius: 8px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Review Update</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName},</h2>
            
            <p>Thank you for submitting your review. We appreciate all feedback from our community.</p>
            
            <div class="info-box">
              <p><strong>Unfortunately, your review was not approved at this time.</strong></p>
            </div>
            
            ${reason ? `
            <div class="reason-box">
              <h3>📝 Reason:</h3>
              <p>${reason}</p>
            </div>
            ` : ''}
            
            <h3>Our Review Guidelines:</h3>
            <ul>
              <li>Reviews should be honest and based on personal experience</li>
              <li>Comments must be respectful and constructive</li>
              <li>Avoid promotional or commercial content</li>
              <li>Focus on the tour package experience</li>
              <li>Minimum 10 characters for better quality feedback</li>
            </ul>
            
            <p>We'd love to feature your review! Feel free to revise and resubmit it following our guidelines.</p>
            
            <div class="footer">
              <p>Questions about our policy? Email support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Custom Tour Quote - Admin reply to custom tour request
   */
  customTourQuote: (name, messageContent) => ({
    subject: "Your Custom Tour Quote - I GO LANKA TOURS 🌴",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .message-box { background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌴 Your Custom Tour Quote</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            
            <p>Thank you for requesting a custom tour with I GO LANKA TOURS! Our experts have reviewed your request and generated a tailored response for you.</p>
            
            <div class="message-box">
              ${messageContent.replace(/\n/g, '<br>')}
            </div>
            
            <p>If you have any questions or wish to proceed with this booking, simply reply to this email or contact us through our website.</p>
            
            <div class="footer">
              <p>Looking forward to planning your dream vacation!</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Contact Reply - Admin reply to general contact message
   */
  contactReply: (name, messageContent, originalSubject) => ({
    subject: `Re: ${originalSubject} - I GO LANKA TOURS`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .message-box { background: white; border-left: 4px solid #4f46e5; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Support Reply</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            
            <p>Thank you for reaching out to us. We have reviewed your inquiry and have an update for you:</p>
            
            <div class="message-box">
              ${messageContent.replace(/\n/g, '<br>')}
            </div>
            
            <p>If you need further assistance, please reply directly to this email.</p>
            
            <div class="footer">
              <p>Best regards,</p>
              <p><strong>I GO LANKA TOURS Support Team</strong></p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Contact Form Confirmation - Confirmation email to submitter
   */
  contactConfirmation: (name) => ({
    subject: "We've Received Your Message! 📬",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ Message Received!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            
            <p>Thank you for reaching out to I GO LANKA TOURS. We've received your message and appreciate you contacting us!</p>
            
            <div class="info-box">
              <h3>📌 What's next?</h3>
              <ul>
                <li>Our team will review your message</li>
                <li>We'll respond as soon as possible (typically within 24 hours)</li>
                <li>Keep an eye on your email for our reply</li>
                <li>You can always contact us again if you have more questions</li>
              </ul>
            </div>
            
            <p><strong>Message Details:</strong></p>
            <p>We have recorded your inquiry and assigned it a reference for our records. Our customer support team will prioritize your request and get back to you shortly.</p>
            
            <p>In the meantime, feel free to explore our website or browse our available tour packages.</p>
            
            <div class="footer">
              <p>Need immediate assistance? Call us or check our FAQ section</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * New Contact Message - Notification to admin
   */
  newContactMessage: (name, email, subject, message) => ({
    subject: `[ADMIN] New Contact Message from ${name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; border: 2px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { margin: 15px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #2196f3; }
          .message-box { background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196f3; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .action-box { background: #e3f2fd; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
          .btn { display: inline-block; background: #2196f3; color: white; padding: 10px 30px; text-decoration: none; border-radius: 5px; margin: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 New Contact Message</h1>
            <p>A visitor has sent you a message through the contact form</p>
          </div>
          <div class="content">
            <div class="info-box">
              <div class="detail-row">
                <span class="label">From:</span> ${name}
              </div>
              <div class="detail-row">
                <span class="label">Email:</span> <a href="mailto:${email}">${email}</a>
              </div>
              <div class="detail-row">
                <span class="label">Subject:</span> ${subject}
              </div>
              <div class="detail-row">
                <span class="label">Received:</span> ${new Date().toLocaleString()}
              </div>
            </div>
            
            <h3>📝 Message:</h3>
            <div class="message-box">
              ${message.replace(/\n/g, '<br>')}
            </div>
            
            <div class="action-box">
              <p><strong>Action Required:</strong></p>
              <p>Please review this message and respond to the visitor promptly.</p>
              <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.igolankatours.com'}/contacts" class="btn">View in Dashboard</a>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from I GO LANKA TOURS admin system</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Guide Assignment - Notification to guide
   */
  guideAssignment: (guideName, touristName, packageName, startDate, endDate, adminNotes) => {
    // Safely format dates with multiple fallbacks
    let startDateStr = 'TBD';
    let endDateStr = 'TBD';
    let durationStr = 'TBD';
    let assignmentDateStr = 'Now';

    try {
      // Ensure we have valid Date objects
      let start = null;
      let end = null;

      // Parse startDate
      if (startDate) {
        try {
          start = new Date(startDate);
          if (isNaN(start.getTime())) {
            start = null;
          }
        } catch (e) {
          console.warn('[EMAIL] Invalid startDate:', startDate, e.message);
        }
      }

      // Parse endDate
      if (endDate) {
        try {
          end = new Date(endDate);
          if (isNaN(end.getTime())) {
            end = null;
          }
        } catch (e) {
          console.warn('[EMAIL] Invalid endDate:', endDate, e.message);
        }
      }

      // Format dates only if valid
      if (start && !isNaN(start.getTime())) {
        try {
          startDateStr = start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
          console.warn('[EMAIL] Error formatting startDate:', e.message);
        }
      }

      if (end && !isNaN(end.getTime())) {
        try {
          endDateStr = end.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
          console.warn('[EMAIL] Error formatting endDate:', e.message);
        }
      }

      // Calculate duration
      if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
        try {
          const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          if (durationDays > 0) {
            durationStr = `${durationDays} days`;
          }
        } catch (e) {
          console.warn('[EMAIL] Error calculating duration:', e.message);
        }
      }

      // Format assignment date
      try {
        const now = new Date();
        assignmentDateStr = now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        console.warn('[EMAIL] Error formatting assignment date:', e.message);
      }

    } catch (e) {
      console.warn('[EMAIL] Unexpected error in date formatting:', e.message);
      // All dates stay as TBD/Now already set above
    }

    return {
      subject: `🎯 New Tour Assignment: ${packageName}`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; border: 2px solid #7c3aed; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { margin: 15px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #7c3aed; display: inline-block; width: 140px; }
          .notes-box { background: #fef3c7; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .action-box { background: #ede9fe; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
          .btn { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .highlight { background: #fef3c7; padding: 5px 10px; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 New Tour Assignment!</h1>
            <p>You have been assigned to guide a new tour</p>
          </div>
          <div class="content">
            <p>Hello <strong>${guideName}</strong>,</p>
            
            <p>Great news! You have been assigned to guide a new tour. Please review the details below and prepare accordingly.</p>
            
            <div class="info-box">
              <h3 style="color: #7c3aed; margin-top: 0;">📋 Tour Details</h3>
              <div class="detail-row">
                <span class="label">Package:</span> <span class="highlight">${packageName || 'Not specified'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Tourist Name:</span> ${touristName || 'Not specified'}
              </div>
              <div class="detail-row">
                <span class="label">Start Date:</span> ${startDateStr}
              </div>
              <div class="detail-row">
                <span class="label">End Date:</span> ${endDateStr}
              </div>
              <div class="detail-row">
                <span class="label">Duration:</span> ${durationStr}
              </div>
              <div class="detail-row">
                <span class="label">Assignment Date:</span> ${assignmentDateStr}
              </div>
            </div>
            
            ${adminNotes ? `
            <div class="notes-box">
              <h3 style="color: #f59e0b; margin-top: 0;">📝 Admin Notes & Instructions</h3>
              <p>${adminNotes.replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}
            
            <div class="action-box">
              <p><strong>Next Steps:</strong></p>
              <ul style="text-align: left; display: inline-block;">
                <li>Review the complete tour details in your dashboard</li>
                <li>Check tourist contact information and special requests</li>
                <li>Prepare your itinerary and materials</li>
                <li>Contact the tourist if you have any questions</li>
              </ul>
              <br>
              <a href="${process.env.FRONTEND_URL || 'https://igolankatours.com'}/guide/bookings" class="btn">View Tour Details</a>
            </div>
            
            <p style="background: #e0e7ff; padding: 15px; border-radius: 8px; border-left: 4px solid #7c3aed;">
              <strong>💡 Reminder:</strong> Please ensure you're well-prepared and arrive on time. Contact the admin if you need any assistance or have concerns about this assignment.
            </p>
            
            <div class="footer">
              <p>This assignment was made by the I GO LANKA TOURS admin team</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
    };
  }
};
