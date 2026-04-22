/**
 * Email Templates for Notifications
 * Professional, branded email templates with a unified premium theme.
 */

const BRAND_COLOR = '#1e3a8a';     // Deep Navy Blue
const SECONDARY_COLOR = '#1e40af';  // Royal Blue
const ACCENT_COLOR = '#fbbf24';    // Sri Lankan Gold
const TEXT_COLOR = '#334155';      // Slate Gray
const LOGO_URL = 'https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/public/tour-images/tour-images/Logo.jpg';

/**
 * Premium email header HTML snippet, featuring the brand logo and name.
 * 
 * @type {string}
 */
export const emailHeader = `
  <div style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #172554 100%); padding: 60px 30px; text-align: center; border-bottom: 5px solid ${ACCENT_COLOR};">
    <a href="${process.env.FRONTEND_URL || 'https://www.igolankatours.com'}" style="text-decoration: none; display: inline-block;">
      <img src="${LOGO_URL}" alt="I GO LANKA TOURS" style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 25px; border: 4px solid rgba(255,255,255,0.2); box-shadow: 0 15px 30px -5px rgba(0,0,0,0.5);">
      <h1 style="color: white; margin: 0; font-size: 34px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">I GO LANKA TOURS</h1>
      <p style="color: ${ACCENT_COLOR}; margin: 10px 0 0 0; font-size: 20px; font-weight: 500; font-style: italic; letter-spacing: 1.5px; opacity: 0.9;">An Amazing Destination</p>
    </a>
  </div>
`;

/**
 * Premium email footer HTML snippet, featuring contact info and social links.
 * 
 * @type {string}
 */
export const emailFooter = `
  <div style="background: #0f172a; padding: 60px 40px; text-align: center; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.05);">
    <div style="margin-bottom: 35px;">
      <img src="${LOGO_URL}" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; opacity: 0.7; margin-bottom: 20px;">
      <h4 style="color: white; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 700;">I GO LANKA TOURS</h4>
      <p style="font-size: 15px; margin: 8px 0; color: #cbd5e1;">Your Gateway to Paradise In Sri Lanka</p>
      <div style="margin: 20px 0; border-top: 1px solid rgba(255,255,255,0.1); width: 60px; display: inline-block;"></div>
      <p style="font-size: 14px; margin: 8px 0; color: #94a3b8;">📞 +94 77 763 9196  |  ✉️ tours.igolanka@gmail.com</p>
      <p style="font-size: 14px; margin: 8px 0; color: #94a3b8;">📍 Katunayaka, Sri Lanka</p>
    </div>
    <div style="padding-top: 30px;">
      <p style="font-size: 12px; margin: 0 0 12px 0; color: #64748b; letter-spacing: 0.5px;">
        © ${new Date().getFullYear()} I GO LANKA TOURS. All Rights Reserved.
      </p>
      <p style="font-size: 11px; margin: 0; color: #475569; max-width: 450px; margin: 0 auto; line-height: 1.6;">
        You've received this automated message because of your activity with I GO LANKA TOURS. 
        Please do not reply directly to this email. For support, reach out to us at our official contact details above.
      </p>
    </div>
  </div>
`;

/**
 * Wraps dynamic content within the global email structure (HTML, Head, Body).
 * 
 * @function emailWrapper
 * @param {string} content - The dynamic HTML content to wrap.
 * @returns {string} Fully formatted HTML document string.
 */
export const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <title>I GO LANKA TOURS</title>
  <style>
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .content { padding: 30px 20px !important; }
      .header { padding: 40px 20px !important; }
    }
    body { background-color: #f8fafc; margin: 0; padding: 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <div class="container" style="max-width: 650px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);">
    ${emailHeader}
    <div class="content" style="padding: 60px 50px; background: white; color: ${TEXT_COLOR}; border-radius: 0 0 20px 20px;">
      ${content}
    </div>
    ${emailFooter}
  </div>
</body>
</html>
`;

const button = (text, link, color = BRAND_COLOR) => `
  <div style="text-align: center; margin: 40px 0;">
    <a href="${link}" style="display: inline-block; background: ${color}; color: white; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(30, 64, 175, 0.3); transition: all 0.3s ease;">
      ${text}
    </a>
  </div>
`;

/**
 * A collection of methods that generate structured email objects (subject and HTML) 
 * for various transactional events.
 * 
 * @namespace emailTemplates
 */
export const emailTemplates = {
    /**
     * Generates a verification email for new account registrations.
     * 
     * @function emailVerification
     * @memberof emailTemplates
     * @param {string} fullName - Recipient's full name.
     * @param {string} verificationLink - Secure URL for email confirmation.
     * @returns {Object} Email object with subject and html.
     */
    emailVerification: (fullName, verificationLink) => ({
      subject: "Verify Your Email - I GO LANKA TOURS ✉️",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Verify Your Email Address</h2>
        <p style="font-size: 17px; line-height: 1.8; margin-bottom: 20px;">Hello ${fullName}! 👋</p>
        <p style="font-size: 17px; line-height: 1.8; margin-bottom: 25px;">Welcome to <strong>I GO LANKA TOURS</strong>. We're thrilled to have you on board! To ensure the security of your account, please verify your email address below.</p>
        
        ${button('Verify Email Address', verificationLink, SECONDARY_COLOR)}
        
        <div style="background: #f0f9ff; border-left: 5px solid #3b82f6; padding: 25px; margin: 35px 0; border-radius: 12px;">
          <strong style="color: #1e40af; font-size: 16px;">⏱️ Limited Time Offer:</strong> This link is valid for <strong>24 hours</strong>. Please complete your registration promptly to start exploring Sri Lanka.
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #3b82f6; font-size: 13px; font-family: 'Courier New', Courier, monospace; background: #f8fafc; padding: 15px; border-radius: 8px;">${verificationLink}</p>
        
        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 30px;">
          <p style="font-size: 15px; color: #64748b;">Best regards,<br><strong style="color: #1e3a8a;">The I Go Lanka Tours Team</strong></p>
        </div>
      `)
    }),

    /**
     * Generates a welcome email for successful registrations.
     * 
     * @function welcome
     * @memberof emailTemplates
     * @param {string} userName - User's name.
     * @param {string} loginLink - Link to the login page.
     * @returns {Object} Email object with subject and html.
     */
    welcome: (userName, loginLink) => ({
      subject: "Welcome to I Go Lanka Tours! 🌴",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Welcome to Paradise! 🌴</h2>
        <p style="font-size: 17px; line-height: 1.8; margin-bottom: 20px;">Hi ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8; margin-bottom: 25px;">Your account at <strong>I GO LANKA TOURS</strong> is now active. You're ready to discover the wonders of Sri Lanka!</p>
        
        <div style="background: #ecfdf5; border-left: 5px solid #10b981; padding: 25px; margin: 30px 0; border-radius: 12px;">
           <p style="margin: 0; color: #064e3b; font-size: 16px; font-weight: 600;">Your Journey Starts Here:</p>
           <ul style="margin: 15px 0 0 0; color: #065f46; line-height: 1.8;">
             <li>Browse curated luxury and adventure packages</li>
             <li>Get matched with professional local guides</li>
             <li>Secure, seamless booking and payments</li>
             <li>24/7 dedicated travel support</li>
           </ul>
        </div>
        
        ${button('Start Your Adventure', loginLink, '#059669')}
        
        <p style="font-size: 16px; line-height: 1.8;">If you need help planning your itinerary, feel free to contact us anytime!</p>
      `)
    }),

    /**
     * Generates a password reset notification.
     * 
     * @function passwordReset
     * @memberof emailTemplates
     * @param {string} fullName - Recipient's full name.
     * @param {string} resetLink - Secure URL for password update.
     * @returns {Object} Email object with subject and html.
     */
    passwordReset: (fullName, resetLink) => ({
      subject: "Reset Your Password - I GO LANKA TOURS 🔐",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Reset Your Password</h2>
        <p style="font-size: 17px; line-height: 1.8; margin-bottom: 20px;">Hello ${fullName},</p>
        <p style="font-size: 17px; line-height: 1.8; margin-bottom: 25px;">We received a request to reset the password for your <strong>I GO LANKA TOURS</strong> account. No problem, it happens!</p>
        
        ${button('Reset Password', resetLink, '#dc2626')}
        
        <div style="background: #fffbeb; border-left: 5px solid #f59e0b; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <strong style="color: #92400e;">Security Notice:</strong> For your protection, this link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Copy/paste link if button doesn't work:</p>
        <p style="word-break: break-all; color: #dc2626; font-size: 12px; font-family: monospace; background: #fef2f2; padding: 10px; border-radius: 6px;">${resetLink}</p>
      `)
    }),

    /**
     * Generates a booking confirmation for tourists.
     * 
     * @function bookingConfirmed
     * @memberof emailTemplates
     * @param {string} userName - Tourist's name.
     * @param {string} packageName - Name of the booked package.
     * @param {Object} bookingDetails - Specific details like date and travelers.
     * @returns {Object} Email object with subject and html.
     */
    bookingConfirmed: (userName, packageName, bookingDetails) => ({
      subject: `🎉 Booking Confirmed - ${packageName}`,
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Booking Confirmed! 🎉</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hi ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8;">Your adventure is booked! We've confirmed your reservation for <strong>${packageName}</strong>.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 30px; border-radius: 15px; margin: 30px 0;">
          <h3 style="color: ${BRAND_COLOR}; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid ${ACCENT_COLOR}; display: inline-block; padding-bottom: 5px;">Booking Details</h3>
          <div style="display: grid; gap: 12px;">
            <p style="margin: 5px 0;"><strong>Package:</strong> ${packageName}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(bookingDetails.travel_date).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Travelers:</strong> ${bookingDetails.travelers}</p>
            <p style="margin: 5px 0;"><strong>Booking ID:</strong> <span style="color: ${SECONDARY_COLOR}; font-weight: 600;">#${bookingDetails.booking_id}</span></p>
          </div>
        </div>
        
        ${button('View Booking Details', `${process.env.FRONTEND_URL}/dashboard/bookings/${bookingDetails.booking_id}`)}
        
        <p style="font-size: 16px; color: #475569;">Our team is now finalizing the details. We'll notify you as soon as your professional guide is assigned.</p>
      `)
    }),

    /**
     * Generates a booking cancellation notification.
     * 
     * @function bookingCancelled
     * @memberof emailTemplates
     * @param {string} userName - Tourist's name.
     * @param {string} packageName - Name of the package.
     * @param {Object} refundDetails - Details about the refund amount and status.
     * @returns {Object} Email object with subject and html.
     */
    bookingCancelled: (userName, packageName, refundDetails) => ({
        subject: `Booking Cancellation Confirmed - ${packageName}`,
        html: emailWrapper(`
      <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Booking Cancelled</h2>
      <p style="font-size: 17px; line-height: 1.8;">Hi ${userName},</p>
      <p style="font-size: 17px; line-height: 1.8;">As requested, your booking for <strong>${packageName}</strong> has been successfully cancelled.</p>
      
      <div style="background: #fff7ed; border-left: 5px solid ${ACCENT_COLOR}; padding: 25px; margin: 30px 0; border-radius: 12px;">
        <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">Refund Summary</h3>
        <p style="margin: 8px 0;"><strong>Refund Amount:</strong> $${refundDetails.amount.toFixed(2)}</p>
        <p style="margin: 8px 0;"><strong>Refund Policy:</strong> ${refundDetails.percentage}% applicable</p>
        <p style="margin: 8px 0;"><strong>Status:</strong> ${refundDetails.status || 'Processing'}</p>
      </div>
      <p style="font-size: 16px; line-height: 1.8;">Refunds typically appear in your account within 5-7 business days. We hope to welcome you back to Sri Lanka in the future!</p>
    `)
    }),

    /**
     * Generates a notification for tourists when a guide is assigned.
     * 
     * @function guideAssigned
     * @memberof emailTemplates
     * @param {string} userName - Tourist's name.
     * @param {string} guideName - Assigned guide's name.
     * @param {string} packageName - Package name.
     * @param {string|Date} tourDate - Tour start date.
     * @returns {Object} Email object with subject and html.
     */
    guideAssigned: (userName, guideName, packageName, tourDate) => ({
        subject: '📅 Guide Assigned to Your Tour',
        html: emailWrapper(`
      <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Your Guide is Ready! 📅</h2>
      <p style="font-size: 17px; line-height: 1.8;">Hi ${userName},</p>
      <p style="font-size: 17px; line-height: 1.8;">We've assigned a top-tier professional guide for your upcoming tour of <strong>${packageName}</strong>.</p>
      
      <div style="background: #f1f5f9; padding: 30px; border-radius: 15px; margin: 30px 0; text-align: center;">
        <div style="margin-bottom: 20px;">
           <span style="font-size: 50px;">👤</span>
        </div>
        <h3 style="color: ${BRAND_COLOR}; margin: 0; font-size: 22px;">${guideName}</h3>
        <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">Professional Local Guide</p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.8;">${guideName} will contact you shortly to coordinate your meeting and discuss last-minute details. Get ready for an authentic Sri Lankan experience!</p>
      ${button('View Tour Assignment', `${process.env.FRONTEND_URL}/dashboard/bookings`)}
    `)
    }),

    /**
     * Generates an acknowledgement email for new guide applications.
     * 
     * @function guideRegistration
     * @memberof emailTemplates
     * @param {string} fullName - Applicant's full name.
     * @returns {Object} Email object with subject and html.
     */
    guideRegistration: (fullName) => ({
      subject: "Guide Registration Received - I GO LANKA TOURS 📋",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Registration Received! 🧭</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hello ${fullName}! 👋</p>
        <p style="font-size: 17px; line-height: 1.8;">Thank you for applying to be a professional guide with <strong>I GO LANKA TOURS</strong>. We've received your registration and are excited to review your profile.</p>
        
        <div style="background: #f1f5f9; border-left: 5px solid ${BRAND_COLOR}; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <h3 style="color: ${BRAND_COLOR}; margin: 0 0 15px 0; font-size: 18px;">What Happens Next?</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>Our team will verify your credentials and documents.</li>
            <li>You'll receive a notification once your profile is approved.</li>
            <li>Once active, you can start receiving tour assignments!</li>
          </ul>
        </div>
        
        <p style="font-size: 16px; line-height: 1.8;">Please ensure your profile is fully completed with your certificates and language skills to speed up the process.</p>
        ${button('Complete Your Profile', `${process.env.FRONTEND_URL}/guide/profile`)}
      `)
    }),

    /**
     * Generates a notification for guides when assigned a new tour.
     * 
     * @function guideAssignment
     * @memberof emailTemplates
     * @param {string} guideName - Guide's name.
     * @param {string} touristName - Primary tourist's name.
     * @param {string} packageName - Tour package name.
     * @param {string|Date} startDate - Start date.
     * @param {string|Date} endDate - End date.
     * @param {string} [adminNotes] - Special instructions from admin.
     * @returns {Object} Email object with subject and html.
     */
    guideAssignment: (guideName, touristName, packageName, startDate, endDate, adminNotes) => ({
      subject: `🎯 New Tour Assignment: ${packageName}`,
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">New Tour Assignment! 🎯</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hello <strong>${guideName}</strong>,</p>
        <p style="font-size: 17px; line-height: 1.8;">You have been assigned as the lead guide for an upcoming tour. Please review the assignment details below.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 30px; border-radius: 15px; margin: 30px 0;">
          <h3 style="color: ${BRAND_COLOR}; margin: 0 0 20px 0; font-size: 20px;">Tour Summary</h3>
          <p style="margin: 8px 0;"><strong>Package:</strong> ${packageName}</p>
          <p style="margin: 8px 0;"><strong>Tourist:</strong> ${touristName}</p>
          <p style="margin: 8px 0;"><strong>Schedule:</strong> ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
        </div>
        
        ${adminNotes ? `
        <div style="background: #fffbeb; border-left: 5px solid ${ACCENT_COLOR}; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 17px;">Admin Instructions</h3>
          <p style="margin: 0; font-style: italic;">${adminNotes}</p>
        </div>
        ` : ''}
        
        ${button('Confirm Assignment', `${process.env.FRONTEND_URL}/guide/dashboard`)}
      `)
    }),

    /**
     * Contact Form - User Copy
     */
    contactFormUser: (name, subject) => ({
      subject: `We've Received Your Inquiry - ${subject}`,
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Hello ${name}! 👋</h2>
        <p style="font-size: 17px; line-height: 1.8;">Thank you for reaching out to <strong>I GO LANKA TOURS</strong>. We've received your inquiry regarding <strong>"${subject}"</strong>.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; margin: 30px 0; border-radius: 12px; text-align: center;">
          <p style="margin: 0; color: ${BRAND_COLOR}; font-weight: 600; font-size: 18px;">One of our travel experts will get back to you within 24 hours.</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.8;">In the meantime, feel free to explore our latest tour packages on our website!</p>
        ${button('Browse Packages', `${process.env.FRONTEND_URL}/packages`, SECONDARY_COLOR)}
      `)
    }),

    /**
     * Contact Form - Admin Alert
     */
    contactFormAdmin: (data) => ({
      subject: `🚨 New Contact Inquiry: ${data.subject}`,
      html: emailWrapper(`
        <h2 style="color: #1e3a8a; margin: 0 0 20px 0; font-size: 24px;">New Customer Inquiry</h2>
        <div style="background: #f1f5f9; padding: 25px; border-radius: 12px;">
          <p style="margin: 10px 0;"><strong>From:</strong> ${data.name}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${data.email}</p>
          <p style="margin: 10px 0;"><strong>Subject:</strong> ${data.subject}</p>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p><strong>Message:</strong></p>
            <p style="font-style: italic; color: #475569;">${data.message}</p>
          </div>
        </div>
        ${button('Reply to Customer', `mailto:${data.email}`)}
      `)
    }),

    /**
     * Generates a confirmation for a submitted review.
     * 
     * @function reviewSubmitted
     * @memberof emailTemplates
     * @param {string} userName - Reviewer's name.
     * @returns {Object} Email object with subject and html.
     */
    reviewSubmitted: (userName) => ({
      subject: "Thank You for Your Review! ⭐",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Review Received! ✨</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hi ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8;">Thank you for sharing your experience with <strong>I GO LANKA TOURS</strong>. Your feedback helps other travelers and helps us maintain our quality standards.</p>
        
        <div style="background: #f0f9ff; border-left: 5px solid #3b82f6; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">What's next?</p>
          <p style="margin: 10px 0 0 0;">Our team will review your submission for quality. Once approved, it will be published live on our platform!</p>
        </div>
        
        <p style="font-size: 16px;">We appreciate you being part of our community.</p>
      `)
    }),

    /**
     * Generates a notification when a review goes live.
     * 
     * @function reviewApproved
     * @memberof emailTemplates
     * @param {string} userName - Reviewer's name.
     * @returns {Object} Email object with subject and html.
     */
    reviewApproved: (userName) => ({
      subject: "Your Review is Now Live! 🎉",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Approved & Live! ✅</h2>
        <p style="font-size: 17px; line-height: 1.8;">Great news ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8;">Your review has been approved and is now visible on the <strong>I GO LANKA TOURS</strong> website. Thank you for helping the travel community!</p>
        
        ${button('View Your Review', `${process.env.FRONTEND_URL}/packages`, '#10b981')}
      `)
    }),

    /**
     * Generates a notification when a review is rejected.
     * 
     * @function reviewRejected
     * @memberof emailTemplates
     * @param {string} userName - Reviewer's name.
     * @param {string} reason - Rejection reason.
     * @returns {Object} Email object with subject and html.
     */
    reviewRejected: (userName, reason) => ({
      subject: "Update Regarding Your Review",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Review Update</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hello ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8;">Your recent review was not approved for publication at this time.</p>
        
        <div style="background: #fef2f2; border-left: 5px solid #ef4444; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Feedback from our team:</p>
          <p style="margin: 10px 0 0 0; font-style: italic;">${reason || 'Does not meet our community guidelines.'}</p>
        </div>
        
        <p style="font-size: 16px;">You are welcome to submit a revised review that follows our guidelines.</p>
      `)
    }),

    /**
     * Generates a notification for approved guides.
     * 
     * @function guideApproved
     * @memberof emailTemplates
     * @param {string} userName - Guide's name.
     * @returns {Object} Email object with subject and html.
     */
    guideApproved: (userName) => ({
      subject: "🎉 Congratulations! Your Guide Account is Approved!",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">You're Approved! 🎉</h2>
        <p style="font-size: 17px; line-height: 1.8;">Congratulations ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8;">Your professional guide application for <strong>I GO LANKA TOURS</strong> has been officially approved. You can now start accepting tour assignments!</p>
        
        <div style="background: #ecfdf5; border-left: 5px solid #10b981; padding: 25px; margin: 30px 0; border-radius: 12px;">
           <p style="margin: 0; color: #064e3b; font-weight: 600;">Next Steps:</p>
           <ul style="margin: 10px 0 0 0; color: #065f46;">
             <li>Complete your profile with Specialties</li>
             <li>Set your languages and bio</li>
             <li>Upload a professional profile photo</li>
           </ul>
        </div>
        
        ${button('Go to Dashboard', `${process.env.FRONTEND_URL}/guide/dashboard`, '#059669')}
      `)
    }),

    /**
     * Generates a notification for rejected guide applications.
     * 
     * @function guideRejected
     * @memberof emailTemplates
     * @param {string} userName - Applicant's name.
     * @param {string} reason - Rejection reason.
     * @returns {Object} Email object with subject and html.
     */
    guideRejected: (userName, reason) => ({
      subject: "Guide Application Update - Action Required",
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Application Update</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hello ${userName},</p>
        <p style="font-size: 17px; line-height: 1.8;">We've reviewed your guide application. At this stage, your application requires some revisions before it can be approved.</p>
        
        <div style="background: #fffbeb; border-left: 5px solid #f59e0b; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Reason for Revision:</p>
          <p style="margin: 10px 0 0 0;">${reason || 'Missing or unclear documentation.'}</p>
        </div>
        
        <p style="font-size: 16px;">Please log in to your portal to upload the required documents or make the necessary changes.</p>
        ${button('Update Application', `${process.env.FRONTEND_URL}/guide/profile`, '#d97706')}
      `)
    }),

    /**
     * Generates a confirmation for guide document uploads.
     * 
     * @function guideDocumentUpload
     * @memberof emailTemplates
     * @param {string} fullName - Guide's name.
     * @param {string} documentType - Type of document uploaded.
     * @returns {Object} Email object with subject and html.
     */
    guideDocumentUpload: (fullName, documentType) => ({
      subject: `Document Received: ${documentType.charAt(0).toUpperCase() + documentType.slice(1)} - I GO LANKA TOURS`,
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Document Received! 📄</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hello ${fullName},</p>
        <p style="font-size: 17px; line-height: 1.8;">We've successfully received your <strong>${documentType}</strong>. Our administration team has been notified and will review it shortly.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; margin: 30px 0; border-radius: 12px; text-align: center;">
          <p style="margin: 0; color: ${BRAND_COLOR}; font-weight: 600; font-size: 16px;">This document will be verified within 24-48 business hours.</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.8;">You'll receive another notification once it has been verified. Thank you for your patience!</p>
        ${button('Check Profile Status', `${process.env.FRONTEND_URL}/guide/profile`, SECONDARY_COLOR)}
      `)
    }),

    /**
     * Contact Form - User Confirmation
     */
    contactConfirmation: (name) => emailWrapper(`
      <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Message Received! 👋</h2>
      <p style="font-size: 17px; line-height: 1.8;">Hello ${name},</p>
      <p style="font-size: 17px; line-height: 1.8;">Thank you for reaching out to <strong>I GO LANKA TOURS</strong>. We've received your message and one of our travel experts will respond within <strong>24 hours</strong>.</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; margin: 30px 0; border-radius: 12px; text-align: center;">
        <p style="margin: 0; color: ${BRAND_COLOR}; font-weight: 600; font-size: 16px;">In the meantime, explore our latest packages!</p>
      </div>
      
      ${button('Browse Tour Packages', `${process.env.FRONTEND_URL || 'https://www.igolankatours.com'}/packages`, SECONDARY_COLOR)}
    `),

    /**
     * Contact Form - Admin Notification
     */
    newContactMessage: (name, email, subject, message) => emailWrapper(`
      <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">🚨 New Contact Inquiry</h2>
      <div style="background: #f1f5f9; padding: 25px; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 10px 0;"><strong>From:</strong> ${name}</p>
        <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
          <p style="font-style: italic; color: #475569; background: white; padding: 15px; border-radius: 8px;">${message}</p>
        </div>
      </div>
      ${button('Reply to Customer', `mailto:${email}`, '#dc2626')}
    `),

    /**
     * Contact Form - Admin Reply to User
     */
    contactReply: (name, replyMessage, originalSubject) => ({
      subject: `Re: ${originalSubject} - I GO LANKA TOURS`,
      html: emailWrapper(`
        <h2 style="color: #0f172a; margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">Reply from I GO LANKA TOURS ✉️</h2>
        <p style="font-size: 17px; line-height: 1.8;">Hello ${name},</p>
        <p style="font-size: 17px; line-height: 1.8;">Thank you for your patience. Here is our response to your inquiry regarding <strong>"${originalSubject}"</strong>:</p>
        
        <div style="background: #f0f9ff; border-left: 5px solid #3b82f6; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <p style="margin: 0; font-size: 16px; line-height: 1.8; color: #1e40af;">${replyMessage}</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.8;">If you have any further questions, please don't hesitate to contact us. We're here to help!</p>
        ${button('Visit Our Website', `${process.env.FRONTEND_URL || 'https://www.igolankatours.com'}`, SECONDARY_COLOR)}
      `)
    })
};

export default emailTemplates;

