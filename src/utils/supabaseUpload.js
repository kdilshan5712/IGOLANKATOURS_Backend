/**
 * SUPABASE STORAGE HELPER
 * Handles file uploads to Supabase Storage for reviews.
 * Bucket: reviews
 * Folder structure: reviews/user-uploads/<user_id>/
 */

import supabase from '../config/supabase.js';
import sharp from 'sharp';

/**
 * Uploads multiple review images to Supabase Storage.
 * Generates unique filenames for each upload and organizes them by user ID.
 * 
 * @async
 * @function uploadReviewImages
 * @param {Array<Object>} files - Array of file objects from multer.
 * @param {string} userId - ID of the user performing the upload (used for folder organization).
 * @returns {Promise<Array<string>>} A list of public URLs for the successfully uploaded images.
 * @throws {Error} If any upload operation fails.
 */
export const uploadReviewImages = async (files, userId) => {
  if (!files || files.length === 0) {
    return [];
  }

  try {
    const uploadPromises = files.map(async (file) => {
      // Generate unique filename using crypto
      const uniqueId = crypto.randomUUID();
      const fileName = `${uniqueId}.webp`; // Always save as optimized WebP
      const filePath = `user-uploads/${userId}/${fileName}`;

      console.log(`📤 Optimizing & Uploading to: reviews/${filePath}`);

      // Compress and resize the image using sharp
      const optimizedBuffer = await sharp(file.buffer)
        .resize({ width: 1920, withoutEnlargement: true }) // Prevent upscaling small images
        .webp({ quality: 80 }) // 80% quality WebP compression
        .toBuffer();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('reviews')
        .upload(filePath, optimizedBuffer, {
          contentType: 'image/webp',
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
 * Deletes a list of review images from Supabase Storage based on their public URLs.
 * Extracts the storage path from the URL before deletion.
 * 
 * @async
 * @function deleteReviewImages
 * @param {Array<string>} imageUrls - List of full public URLs to the images to be deleted.
 * @param {string} userId - ID of the user who owns the images.
 * @returns {Promise<boolean>} True if all deletions were successful or if the list was empty.
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
 * Validates an array of uploaded files against constraints like count, size, and type.
 * 
 * @function validateReviewImages
 * @param {Array<Object>} [files] - Array of file objects from multer.
 * @returns {Object} Validation result { valid: boolean, error: string|undefined }.
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
