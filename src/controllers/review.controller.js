/**
 * REVIEWS CONTROLLER
 * Handles all review-related operations: submission, public display, admin moderation
 * Supports text-only and image-based reviews with Supabase Storage integration
 */

import db from '../config/db.js';
import { sendEmail, emailTemplates } from '../utils/sendEmail.js';
import { 
  uploadReviewImages, 
  deleteReviewImages, 
  validateReviewImages 
} from '../utils/supabaseUpload.js';

/**
 * 1️⃣ PUBLIC: GET REVIEWS FOR PACKAGE
 * Returns only approved reviews for a specific package
 * Includes images if available
 * GET /api/reviews/package/:packageId
 */
export const getApprovedReviewsByPackage = async (req, res) => {
  try {
    const { packageId } = req.params;

    // Validate packageId
    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: "Package ID is required"
      });
    }

    const result = await db.query(`
      SELECT 
        r.review_id,
        r.rating,
        r.title,
        r.comment,
        r.images,
        r.created_at,
        COALESCE(t.full_name, u.email) as reviewer_name,
        p.name as package_name
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      JOIN tour_packages p ON r.package_id = p.package_id
      WHERE r.package_id = $1 
        AND r.status = 'approved'
      ORDER BY r.created_at DESC
      LIMIT 50
    `, [packageId]);

    res.json({
      success: true,
      count: result.rows.length,
      reviews: result.rows
    });

  } catch (err) {
    console.error("getApprovedReviewsByPackage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch package reviews",
      error: err.message
    });
  }
};

/**
 * 2️⃣ PUBLIC: GET ALL APPROVED REVIEWS
 * Returns all approved reviews across all packages
 * Includes images for gallery integration
 * GET /api/reviews
 */
export const getAllApprovedReviews = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const result = await db.query(`
      SELECT 
        r.review_id,
        r.rating,
        r.title,
        r.comment,
        r.images,
        r.created_at,
        COALESCE(t.full_name, u.email) as reviewer_name,
        p.name as package_name,
        p.package_id
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      JOIN tour_packages p ON r.package_id = p.package_id
      WHERE r.status = 'approved'
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      success: true,
      count: result.rows.length,
      reviews: result.rows
    });

  } catch (err) {
    console.error("getAllApprovedReviews error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: err.message
    });
  }
};

/**
 * 2️⃣B PUBLIC: GET REVIEWS WITH IMAGES FOR GALLERY
 * Returns only approved reviews that have images
 * Used by Gallery page to display review photos
 * GET /api/reviews/gallery
 */
export const getReviewsForGallery = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(`
      SELECT 
        r.review_id,
        r.rating,
        r.title,
        r.comment,
        r.images,
        r.created_at,
        COALESCE(t.full_name, u.email) as reviewer_name,
        p.name as package_name,
        p.package_id,
        p.image_url as package_image
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      JOIN tour_packages p ON r.package_id = p.package_id
      WHERE r.status = 'approved'
        AND r.images IS NOT NULL 
        AND array_length(r.images, 1) > 0
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Flatten images array for gallery display
    const galleryItems = [];
    result.rows.forEach(review => {
      if (review.images && review.images.length > 0) {
        review.images.forEach(imageUrl => {
          galleryItems.push({
            review_id: review.review_id,
            image_url: imageUrl,
            package_name: review.package_name,
            package_id: review.package_id,
            reviewer_name: review.reviewer_name,
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            created_at: review.created_at
          });
        });
      }
    });

    res.json({
      success: true,
      count: galleryItems.length,
      reviewCount: result.rows.length,
      galleryItems
    });

  } catch (err) {
    console.error("getReviewsForGallery error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images",
      error: err.message
    });
  }
};

/**
 * 3️⃣ PROTECTED: SUBMIT REVIEW
 * Only authenticated tourists can submit reviews
 * Supports text-only OR text + images (up to 5 images)
 * Uploads images to Supabase Storage: reviews/user-uploads/<user_id>/
 * Saves image URLs in reviews.images[] array
 * Sets status to 'pending' (requires admin approval)
 * POST /api/reviews
 * Body: { packageId, rating, title, comment }
 * Files: images (optional, multipart/form-data)
 */
export const submitReview = async (req, res) => {
  try {
    const { packageId, rating, title, comment } = req.body;
    const userId = req.user.user_id;
    const files = req.files; // Array of uploaded images (if any)

    console.log("\n================================================");
    console.log("=== REVIEW SUBMISSION REQUEST ===");
    console.log("================================================");
    console.log("📝 Review data:", { packageId, rating, title, comment });
    console.log("📸 Images uploaded:", files ? files.length : 0);
    console.log("👤 User ID:", userId);

    // ========================================
    // VALIDATION
    // ========================================
    
    // Validate required fields
    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: "Package ID is required"
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      });
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Comment must be at least 10 characters long"
      });
    }

    // Validate images if provided
    if (files && files.length > 0) {
      const validation = validateReviewImages(files);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      console.log(`✅ ${files.length} images validated successfully`);
    }

    // ========================================
    // AUTHORIZATION CHECKS
    // ========================================

    // Check if user is tourist
    const userCheck = await db.query(
      'SELECT role FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (userCheck.rows[0].role !== 'tourist') {
      return res.status(403).json({
        success: false,
        message: "Only tourists can submit reviews"
      });
    }

    // Check if package exists
    const packageCheck = await db.query(
      'SELECT package_id, name FROM tour_packages WHERE package_id = $1',
      [packageId]
    );

    if (packageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    // ========================================
    // BOOKING VALIDATION (CRITICAL)
    // ========================================
    
    // Check if user has a confirmed booking for this package
    const bookingCheck = await db.query(`
      SELECT b.booking_id, b.status, b.travel_date
      FROM bookings b
      WHERE b.user_id = $1 AND b.package_id = $2 AND b.status = 'confirmed'
      ORDER BY b.created_at DESC
      LIMIT 1
    `, [userId, packageId]);

    if (bookingCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You can only review packages you have booked"
      });
    }

    const booking = bookingCheck.rows[0];
    const bookingId = booking.booking_id;

    // Check for duplicate review (one review per booking)
    const existingReview = await db.query(`
      SELECT review_id FROM reviews 
      WHERE booking_id = $1
    `, [bookingId]);

    if (existingReview.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a review for this booking"
      });
    }

    // ========================================
    // IMAGE UPLOAD TO SUPABASE STORAGE
    // ========================================

    let imageUrls = [];
    
    if (files && files.length > 0) {
      try {
        console.log(`📤 Uploading ${files.length} images to Supabase Storage...`);
        imageUrls = await uploadReviewImages(files, userId);
        console.log(`✅ Images uploaded successfully:`, imageUrls);
      } catch (uploadError) {
        console.error('❌ Image upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload images. Please try again.",
          error: uploadError.message
        });
      }
    } else {
      console.log("ℹ️  No images provided - text-only review");
    }

    // ========================================
    // INSERT REVIEW INTO DATABASE
    // ========================================

    const result = await db.query(`
      INSERT INTO reviews (
        user_id, 
        package_id,
        booking_id, 
        rating, 
        title, 
        comment, 
        images, 
        status, 
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING 
        review_id, 
        user_id, 
        package_id,
        booking_id, 
        rating, 
        title, 
        comment,
        images,
        status, 
        created_at
    `, [
      userId, 
      packageId,
      bookingId, 
      rating, 
      title || null, 
      comment,
      imageUrls.length > 0 ? imageUrls : null
    ]);

    const review = result.rows[0];

    console.log("✅ Review saved to database:", review.review_id);

    // ========================================
    // SEND CONFIRMATION EMAIL
    // ========================================

    try {
      const userResult = await db.query(
        'SELECT email, full_name FROM users u LEFT JOIN tourist t ON u.user_id = t.user_id WHERE u.user_id = $1',
        [userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const fullName = user.full_name || user.email.split('@')[0];
        const emailContent = emailTemplates.reviewSubmitted(fullName);
        await sendEmail(user.email, emailContent.subject, emailContent.html);
        console.log("📧 Confirmation email sent to user");
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("⚠️  Email notification failed (non-critical):", emailError.message);
    }

    console.log("================================================\n");

    // ========================================
    // RETURN SUCCESS RESPONSE
    // ========================================

    res.status(201).json({
      success: true,
      message: imageUrls.length > 0 
        ? `Review with ${imageUrls.length} image(s) submitted successfully and is pending approval`
        : "Review submitted successfully and is pending approval",
      review: {
        ...review,
        hasImages: imageUrls.length > 0,
        imageCount: imageUrls.length
      }
    });

  } catch (err) {
    console.error("❌ submitReview error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit review",
      error: err.message
    });
  }
};

/**
 * 4️⃣ ADMIN: GET ALL REVIEWS (WITH FILTERS)
 * Includes images for moderation
 * GET /api/admin/reviews?status=pending&limit=10&offset=0
 */
export const getAllReviewsAdmin = async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    // Build query based on status filter using parameterized queries
    let query = `
      SELECT 
        r.review_id,
        r.user_id,
        r.package_id,
        r.booking_id,
        r.rating,
        r.title,
        r.comment,
        r.images,
        r.status,
        r.created_at,
        r.moderated_by,
        r.moderated_at,
        COALESCE(t.full_name, u.email) as reviewer_name,
        u.email as reviewer_email,
        p.name as package_name,
        COALESCE(admin_t.full_name, admin_u.email) as moderated_by_name
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN tourist t ON u.user_id = t.user_id
      JOIN tour_packages p ON r.package_id = p.package_id
      LEFT JOIN users admin_u ON r.moderated_by = admin_u.user_id
      LEFT JOIN tourist admin_t ON r.moderated_by = admin_t.user_id
    `;

    const params = [limit, offset];

    if (status && status !== 'all') {
      query += ` WHERE r.status = $3`;
      params.splice(2, 0, status);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`;

    const result = await db.query(query, params);

    // Get counts by status
    const countResult = await db.query(`
      SELECT status, COUNT(*) as count FROM reviews GROUP BY status
    `);

    const statusCounts = {};
    countResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });

    res.json({
      success: true,
      count: result.rows.length,
      statusCounts,
      reviews: result.rows
    });

  } catch (err) {
    console.error("getAllReviewsAdmin error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: err.message
    });
  }
};

/**
 * 5️⃣ ADMIN: APPROVE REVIEW
 * PATCH /api/admin/reviews/:reviewId/approve
 */
export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const adminId = req.user.user_id;

    // Validate reviewId
    if (!reviewId) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required"
      });
    }

    // Check if review exists
    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE review_id = $1',
      [reviewId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const review = reviewCheck.rows[0];

    // Update review status
    const result = await db.query(`
      UPDATE reviews 
      SET status = 'approved', moderated_by = $1, moderated_at = NOW()
      WHERE review_id = $2
      RETURNING *
    `, [adminId, reviewId]);

    // Get user email for notification
    const userResult = await db.query(
      'SELECT u.email, COALESCE(t.full_name, u.email) as full_name FROM users u LEFT JOIN tourist t ON u.user_id = t.user_id WHERE u.user_id = $1',
      [review.user_id]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const fullName = user.full_name || user.email.split('@')[0];
      const emailContent = emailTemplates.reviewApproved(fullName);
      await sendEmail(user.email, emailContent.subject, emailContent.html);
    }

    res.json({
      success: true,
      message: "Review approved successfully",
      review: result.rows[0]
    });

  } catch (err) {
    console.error("approveReview error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to approve review",
      error: err.message
    });
  }
};

/**
 * 6️⃣ ADMIN: REJECT REVIEW
 * PATCH /api/admin/reviews/:reviewId/reject
 * Body: { reason }
 */
export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.user_id;

    // Validate reviewId
    if (!reviewId) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required"
      });
    }

    // Check if review exists
    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE review_id = $1',
      [reviewId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const review = reviewCheck.rows[0];

    // Update review status
    const result = await db.query(`
      UPDATE reviews 
      SET status = 'rejected', moderated_by = $1, moderated_at = NOW()
      WHERE review_id = $2
      RETURNING *
    `, [adminId, reviewId]);

    // Get user email for notification
    const userResult = await db.query(
      'SELECT u.email, COALESCE(t.full_name, u.email) as full_name FROM users u LEFT JOIN tourist t ON u.user_id = t.user_id WHERE u.user_id = $1',
      [review.user_id]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const fullName = user.full_name || user.email.split('@')[0];
      const emailContent = emailTemplates.reviewRejected(fullName, reason);
      await sendEmail(user.email, emailContent.subject, emailContent.html);
    }

    res.json({
      success: true,
      message: "Review rejected successfully",
      review: result.rows[0]
    });

  } catch (err) {
    console.error("rejectReview error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to reject review",
      error: err.message
    });
  }
};

/**
 * 7️⃣ ADMIN: DELETE REVIEW
 * Permanently deletes review and associated images from Supabase Storage
 * DELETE /api/admin/reviews/:reviewId
 */
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Get review details before deletion (to delete images)
    const reviewCheck = await db.query(
      'SELECT review_id, user_id, images FROM reviews WHERE review_id = $1',
      [reviewId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const review = reviewCheck.rows[0];

    // Delete images from Supabase Storage if they exist
    if (review.images && review.images.length > 0) {
      console.log(`🗑️  Deleting ${review.images.length} images from storage...`);
      try {
        await deleteReviewImages(review.images, review.user_id);
        console.log("✅ Images deleted from storage");
      } catch (storageError) {
        console.error("⚠️  Failed to delete images from storage (non-critical):", storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete review from database
    const result = await db.query(
      'DELETE FROM reviews WHERE review_id = $1 RETURNING *',
      [reviewId]
    );

    console.log("✅ Review deleted from database");

    res.json({
      success: true,
      message: "Review deleted successfully"
    });

  } catch (err) {
    console.error("deleteReview error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: err.message
    });
  }
};
