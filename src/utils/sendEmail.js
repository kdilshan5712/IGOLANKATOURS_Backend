import nodemailer from "nodemailer";

/**
 * EMAIL UTILITY
 * Sends emails using NodeMailer
 * Fails silently to prevent blocking API responses
 */

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
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌴 Welcome to I GO LANKA TOURS!</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName}! 👋</h2>
            <p>Welcome to Sri Lanka's premier travel platform! We're excited to have you join our community.</p>
            
            <p><strong>Your account is now active!</strong></p>
            
            <p>You can now:</p>
            <ul>
              <li>Browse amazing tour packages</li>
              <li>Connect with verified tour guides</li>
              <li>Book unforgettable experiences in Sri Lanka</li>
              <li>Manage your travel itineraries</li>
            </ul>
            
            <p>Start exploring the beauty of Sri Lanka today!</p>
            
            <div class="footer">
              <p>If you have any questions, feel free to contact our support team.</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Email Verification Email
   */
  emailVerification: (fullName, verificationLink) => ({
    subject: "Verify Your Email - I GO LANKA TOURS ✉️",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .button:hover { opacity: 0.9; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .link-text { word-break: break-all; color: #667eea; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Verify Your Email</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName}! 👋</h2>
            <p>Thank you for registering with <strong>I GO LANKA TOURS</strong>!</p>
            
            <p>To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </div>
            
            <div class="info-box">
              <strong>⏰ Important:</strong> This verification link will expire in <strong>24 hours</strong>.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p class="link-text">${verificationLink}</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't create an account with I GO LANKA TOURS, please ignore this email.
            </div>
            
            <div class="footer">
              <p>Need help? Contact us at support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  /**
   * Password Reset Email
   */
  passwordReset: (fullName, resetLink) => ({
    subject: "Reset Your Password - I GO LANKA TOURS 🔐",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .button:hover { opacity: 0.9; }
          .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .warning { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .link-text { word-break: break-all; color: #f5576c; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName}! 👋</h2>
            <p>We received a request to reset your password for your <strong>I GO LANKA TOURS</strong> account.</p>
            
            <p>Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <div class="info-box">
              <strong>⏰ Important:</strong> This link will expire in <strong>1 hour</strong> for security reasons.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p class="link-text">${resetLink}</p>
            
            <div class="warning">
              <strong>⚠️ Security Alert:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </div>
            
            <p>For your security:</p>
            <ul>
              <li>Never share your password with anyone</li>
              <li>Use a strong, unique password</li>
              <li>This link can only be used once</li>
            </ul>
            
            <div class="footer">
              <p>Need help? Contact us at support@igolankatours.com</p>
              <p>&copy; ${new Date().getFullYear()} I GO LANKA TOURS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
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
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
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
              <h3>📝 Reason:</h3>
              <p>${reason}</p>
            </div>
            ` : ''}
            
            <h3>What you can do:</h3>
            <ul>
              <li>Review the requirements for tour guide registration</li>
              <li>Ensure all documents are valid and clearly visible</li>
              <li>Contact our support team for clarification</li>
              <li>Re-apply once you've addressed the issues</li>
            </ul>
            
            <p>We appreciate your understanding and encourage you to reach out if you have any questions.</p>
            
            <div class="footer">
              <p>Questions? Email us at support@igolankatours.com</p>
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
  })
};
