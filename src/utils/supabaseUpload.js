/**
 * SUPABASE STORAGE HELPER
 * Handles file uploads to Supabase Storage for reviews
 * Bucket: reviews
 * Folder structure: reviews/user-uploads/<user_id>/
 */

import supabase from '../config/supabase.js';
import crypto from 'crypto';

/**
 * Upload review images to Supabase Storage
 * @param {Array} files - Array of files from multer (req.files)
 * @param {string} userId - User ID for folder structure
 * @returns {Promise<Array>} Array of public URLs
 */
export const uploadReviewImages = async (files, userId) => {
  if (!files || files.length === 0) {
    return [];
  }

  try {
    const uploadPromises = files.map(async (file) => {
      // Generate unique filename using crypto
      const fileExt = file.originalname.split('.').pop();
      const uniqueId = crypto.randomUUID();
      const fileName = `${uniqueId}.${fileExt}`;
      const filePath = `user-uploads/${userId}/${fileName}`;

      console.log(`📤 Uploading to: reviews/${filePath}`);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('reviews')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) {
        console.error('❌ Supabase upload error:', error);
        throw new Error(`Failed to upload ${file.originalname}: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('reviews')
        .getPublicUrl(filePath);

      console.log(`✅ Uploaded successfully: ${publicUrlData.publicUrl}`);
      
      return publicUrlData.publicUrl;
    });

    const imageUrls = await Promise.all(uploadPromises);
    return imageUrls;

  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
};

/**
 * Delete review images from Supabase Storage
 * @param {Array} imageUrls - Array of image URLs to delete
 * @param {string} userId - User ID for folder path
 * @returns {Promise<boolean>}
 */
export const deleteReviewImages = async (imageUrls, userId) => {
  if (!imageUrls || imageUrls.length === 0) {
    return true;
  }

  try {
    // Extract file paths from URLs
    const filePaths = imageUrls.map(url => {
      const urlParts = url.split('/reviews/');
      return urlParts[1]; // e.g., "user-uploads/<userId>/filename.jpg"
    });

    console.log(`🗑️  Deleting ${filePaths.length} images from Supabase`);

    const { error } = await supabase.storage
      .from('reviews')
      .remove(filePaths);

    if (error) {
      console.error('❌ Delete error:', error);
      return false;
    }

    console.log('✅ Images deleted successfully');
    return true;

  } catch (error) {
    console.error('❌ Delete failed:', error);
    return false;
  }
};

/**
 * Validate image files
 * @param {Array} files - Array of files from multer
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateReviewImages = (files) => {
  const MAX_FILES = 5;
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB per file
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!files || files.length === 0) {
    return { valid: true }; // No files is valid (optional images)
  }

  // Check number of files
  if (files.length > MAX_FILES) {
    return {
      valid: false,
      error: `Maximum ${MAX_FILES} images allowed. You uploaded ${files.length}.`
    };
  }

  // Check each file
  for (const file of files) {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.originalname}. Allowed: JPEG, PNG, WebP`
      };
    }

    // Check file size
    if (file.size > MAX_SIZE) {
      return {
        valid: false,
        error: `File too large: ${file.originalname}. Maximum size: 5MB`
      };
    }
  }

  return { valid: true };
};

export default {
  uploadReviewImages,
  deleteReviewImages,
  validateReviewImages
};
