/**
 * Email Templates for Notifications
 * Professional, branded email templates for all notification types
 */

const BRAND_COLOR = '#2563eb'; // Blue
const ACCENT_COLOR = '#f59e0b'; // Gold

const emailHeader = `
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
    <img src="https://exfyprnpkplhzuuloebf.supabase.co/storage/v1/object/public/tour-images/tour-images/Logo.jpg" alt="I GO LANKA TOURS" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px; border: 3px solid rgba(255,255,255,0.2);">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">I GO LANKA TOURS</h1>
    <p style="color: #fbbf24; margin: 5px 0 0 0; font-size: 16px; font-weight: 500; font-style: italic;">An Amazing Destination</p>
  </div>
`;

const emailFooter = `
  <div style="background: #f8fafc; padding: 40px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
    <div style="margin-bottom: 25px;">
      <h4 style="color: #1e293b; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Contact Us</h4>
      <p style="color: #64748b; font-size: 14px; margin: 5px 0;">📞 +94 77 763 9196  |  ✉️ tours.igolanka@gmail.com</p>
      <p style="color: #64748b; font-size: 14px; margin: 5px 0;">📍 Katunayaka, Sri Lanka</p>
    </div>
    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 5px 0;">
        © 2026 I GO LANKA TOURS. All rights reserved.
      </p>
      <p style="color: #cbd5e1; font-size: 11px; margin: 0;">
        You're receiving this because you booked a tour with us. This is an automated notification.
      </p>
    </div>
  </div>
`;

const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iGo Lanka Tours</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    ${emailHeader}
    <div style="padding: 40px 30px;">
      ${content}
    </div>
    ${emailFooter}
  </div>
</body>
</html>
`;

const button = (text, link) => `
  <a href="${link}" style="display: inline-block; background: ${BRAND_COLOR}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
    ${text}
  </a>
`;

export const emailTemplates = {
    /**
     * Booking Confirmed
     */
    bookingConfirmed: (userName, packageName, bookingDetails) => ({
        subject: `🎉 Booking Confirmed - ${packageName}`,
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Booking Confirmed!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Great news! Your booking for <strong>${packageName}</strong> has been confirmed.
      </p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Booking Details</h3>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Travel Date:</strong> ${new Date(bookingDetails.travel_date).toLocaleDateString()}</p>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Travelers:</strong> ${bookingDetails.travelers}</p>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Total Price:</strong> $${bookingDetails.total_price}</p>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Booking ID:</strong> ${bookingDetails.booking_id}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        We'll notify you once a guide is assigned to your tour. Get ready for an amazing adventure!
      </p>
      ${button('View Booking', `${process.env.FRONTEND_URL}/dashboard/bookings/${bookingDetails.booking_id}`)}
    `)
    }),

    /**
     * Booking Cancelled
     */
    bookingCancelled: (userName, packageName, refundDetails) => ({
        subject: `Booking Cancellation Confirmed - ${packageName}`,
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Booking Cancelled</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your booking for <strong>${packageName}</strong> has been cancelled as requested.
      </p>
      <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${ACCENT_COLOR};">
        <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">Refund Information</h3>
        <p style="color: #78350f; margin: 5px 0;"><strong>Refund Amount:</strong> $${refundDetails.amount.toFixed(2)}</p>
        <p style="color: #78350f; margin: 5px 0;"><strong>Refund Percentage:</strong> ${refundDetails.percentage}%</p>
        <p style="color: #78350f; margin: 5px 0;"><strong>Days Until Travel:</strong> ${refundDetails.daysUntilTravel} days</p>
        <p style="color: #78350f; margin: 5px 0;"><strong>Status:</strong> ${refundDetails.status}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your refund will be processed within 5-7 business days. We hope to see you again soon!
      </p>
      ${button('View My Bookings', `${process.env.FRONTEND_URL}/dashboard/bookings`)}
    `)
    }),

    /**
     * Guide Approved
     */
    guideApproved: (guideName) => ({
        subject: '🎉 Guide Application Approved!',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Congratulations! 🎉</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${guideName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Excellent news! Your guide application has been <strong style="color: #059669;">approved</strong>.
      </p>
      <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
        <p style="color: #065f46; margin: 0; font-size: 16px;">
          ✅ You can now start accepting tour assignments<br>
          ✅ Your profile is visible to tourists<br>
          ✅ Access your guide dashboard to manage bookings
        </p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Welcome to the iGo Lanka Tours family! We're excited to have you on board.
      </p>
      ${button('Go to Dashboard', `${process.env.FRONTEND_URL}/guide/dashboard`)}
    `)
    }),

    /**
     * Guide Rejected
     */
    guideRejected: (guideName, reason) => ({
        subject: 'Guide Application - Revision Required',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Application Requires Revision</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${guideName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for your interest in becoming a guide with iGo Lanka Tours. After reviewing your application, we need some additional information or revisions.
      </p>
      <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <h3 style="color: #991b1b; margin: 0 0 10px 0; font-size: 16px;">Reason for Revision:</h3>
        <p style="color: #7f1d1d; margin: 0;">${reason}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Please update your application and resubmit. We're here to help if you have any questions!
      </p>
      ${button('Update Application', `${process.env.FRONTEND_URL}/guide/application`)}
    `)
    }),

    /**
     * Review Submitted
     */
    reviewSubmitted: (userName, packageName) => ({
        subject: 'Review Submitted Successfully',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Thank You for Your Review!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for sharing your experience with <strong>${packageName}</strong>!
      </p>
      <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${BRAND_COLOR};">
        <p style="color: #1e40af; margin: 0; font-size: 16px;">
          📝 Your review has been submitted and is pending approval<br>
          ⏱️ Reviews are typically approved within 24 hours<br>
          📧 We'll notify you once your review is published
        </p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your feedback helps other travelers make informed decisions. We appreciate you!
      </p>
    `)
    }),

    /**
     * Review Approved
     */
    reviewApproved: (userName, packageName) => ({
        subject: '✅ Your Review Has Been Approved!',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Review Approved!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Great news! Your review for <strong>${packageName}</strong> has been approved and is now live on our website.
      </p>
      <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
        <p style="color: #065f46; margin: 0; font-size: 16px;">
          ✅ Your review is now visible to all users<br>
          🌟 Thank you for helping our community!
        </p>
      </div>
      ${button('View Your Review', `${process.env.FRONTEND_URL}/packages`)}
    `)
    }),

    /**
     * Review Rejected
     */
    reviewRejected: (userName, packageName, reason) => ({
        subject: 'Review Requires Revision',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Review Requires Revision</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for submitting your review for <strong>${packageName}</strong>. We need some revisions before we can publish it.
      </p>
      <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${ACCENT_COLOR};">
        <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">Reason:</h3>
        <p style="color: #78350f; margin: 0;">${reason}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Please update your review and resubmit. We appreciate your feedback!
      </p>
    `)
    }),

    /**
     * Guide Assigned
     */
    guideAssigned: (userName, guideName, packageName, tourDate) => ({
        subject: '📅 Guide Assigned to Your Tour',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Your Guide Has Been Assigned!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Exciting news! <strong>${guideName}</strong> has been assigned as your guide for <strong>${packageName}</strong>.
      </p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Tour Details</h3>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Guide:</strong> ${guideName}</p>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Package:</strong> ${packageName}</p>
        <p style="color: #6b7280; margin: 5px 0;"><strong>Date:</strong> ${new Date(tourDate).toLocaleDateString()}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your guide will contact you soon with more details. Get ready for an amazing adventure!
      </p>
      ${button('View Booking', `${process.env.FRONTEND_URL}/dashboard/bookings`)}
    `)
    }),

    /**
     * Payment Received
     */
    paymentReceived: (userName, amount, bookingId) => ({
        subject: '✅ Payment Received',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Payment Confirmed!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        We've successfully received your payment of <strong>$${amount.toFixed(2)}</strong>.
      </p>
      <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
        <p style="color: #065f46; margin: 0; font-size: 16px;">
          ✅ Payment processed successfully<br>
          📧 Receipt sent to your email<br>
          🎫 Your booking is confirmed
        </p>
      </div>
      ${button('View Booking', `${process.env.FRONTEND_URL}/dashboard/bookings/${bookingId}`)}
    `)
    }),

    /**
     * Refund Processed
     */
    refundProcessed: (userName, amount, bookingId) => ({
        subject: '💰 Refund Processed',
        html: emailWrapper(`
      <h2 style="color: #111827; margin: 0 0 20px 0;">Refund Processed</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your refund of <strong>$${amount.toFixed(2)}</strong> has been processed successfully.
      </p>
      <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${BRAND_COLOR};">
        <p style="color: #1e40af; margin: 0; font-size: 16px;">
          💰 Refund Amount: $${amount.toFixed(2)}<br>
          ⏱️ Processing Time: 5-7 business days<br>
          📧 Confirmation sent to your email
        </p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        The refund will appear in your original payment method within 5-7 business days.
      </p>
    `)
    })
};
