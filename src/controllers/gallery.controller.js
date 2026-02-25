/**
 * GALLERY MANAGEMENT CONTROLLER
 * Admin dashboard functionality for managing gallery images
 * Supports: upload, delete, categorize, and display management
 */

import db from '../config/db.js';
import supabase from '../config/supabase.js';
import crypto from 'crypto';

/**
 * 1️⃣ GET ALL GALLERY IMAGES (Admin)
 * GET /api/admin/gallery
 */
export const getAllGalleryImages = async (req, res) => {
  try {
    const { category, status, sort = 'created_at', limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        g.gallery_id,
        g.image_url,
        g.title,
        g.description,
        g.category,
        g.is_featured,
        g.display_order,
        g.status,
        g.created_at,
        g.updated_at,
        COUNT(*) OVER() as total_count
      FROM gallery g
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND g.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND g.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY g.${sort} DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;

    res.json({
      success: true,
      count: result.rows.length,
      totalCount,
      gallery: result.rows.map(row => {
        const { total_count, ...rest } = row;
        return rest;
      })
    });

  } catch (err) {
    console.error("getAllGalleryImages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images",
      error: err.message
    });
  }
};

/**
 * 2️⃣ GET GALLERY CATEGORIES
 * GET /api/admin/gallery/categories
 */
export const getGalleryCategories = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT category 
      FROM gallery 
      WHERE status = 'active'
      ORDER BY category
    `);

    res.json({
      success: true,
      categories: result.rows.map(r => r.category)
    });

  } catch (err) {
    console.error("getGalleryCategories error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: err.message
    });
  }
};

/**
 * 3️⃣ UPLOAD GALLERY IMAGE
 * POST /api/admin/gallery/upload
 * Multipart form-data with image file
 */
export const uploadGalleryImage = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const file = req.file;

    console.log("\n================================================");
    console.log("=== GALLERY IMAGE UPLOAD ===");
    console.log("================================================");
    console.log("📸 File:", file ? file.originalname : "none");
    console.log("📝 Title:", title);
    console.log("📂 Category:", category);

    // Validate
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required"
      });
    }

    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Title must be at least 3 characters"
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    // Upload to Supabase
    const fileExt = file.originalname.split('.').pop();
    const uniqueId = crypto.randomUUID();
    const fileName = `${uniqueId}.${fileExt}`;
    const filePath = `gallery/${category}/${fileName}`;

    console.log(`📤 Uploading to: ${filePath}`);

    const { data, error } = await supabase.storage
      .from('tour-images')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('❌ Upload error:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error: error.message
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('tour-images')
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;
    console.log(`✅ Image uploaded: ${imageUrl}`);

    // Save to database
    const result = await db.query(`
      INSERT INTO gallery (
        image_url,
        title,
        description,
        category,
        status,
        display_order,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'active', 
        (SELECT COALESCE(MAX(display_order), 0) + 1 FROM gallery),
        NOW(),
        NOW()
      )
      RETURNING *
    `, [imageUrl, title, description || null, category]);

    const galleryImage = result.rows[0];

    console.log("✅ Gallery image saved:", galleryImage.gallery_id);
    console.log("================================================\n");

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      gallery: galleryImage
    });

  } catch (err) {
    console.error("❌ uploadGalleryImage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: err.message
    });
  }
};

/**
 * 4️⃣ UPDATE GALLERY IMAGE
 * PATCH /api/admin/gallery/:galleryId
 */
export const updateGalleryImage = async (req, res) => {
  try {
    const { galleryId } = req.params;
    const { title, description, category, is_featured, display_order, status } = req.body;

    console.log("📝 Updating gallery image:", galleryId);

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (is_featured !== undefined) {
      updates.push(`is_featured = $${paramIndex}`);
      params.push(is_featured);
      paramIndex++;
    }

    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex}`);
      params.push(display_order);
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update"
      });
    }

    updates.push(`updated_at = NOW()`);

    params.push(galleryId);

    const query = `
      UPDATE gallery 
      SET ${updates.join(', ')}
      WHERE gallery_id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found"
      });
    }

    console.log("✅ Gallery image updated");

    res.json({
      success: true,
      message: "Gallery image updated successfully",
      gallery: result.rows[0]
    });

  } catch (err) {
    console.error("updateGalleryImage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update gallery image",
      error: err.message
    });
  }
};

/**
 * 5️⃣ DELETE GALLERY IMAGE
 * DELETE /api/admin/gallery/:galleryId
 */
export const deleteGalleryImage = async (req, res) => {
  try {
    const { galleryId } = req.params;

    console.log("🗑️  Deleting gallery image:", galleryId);

    // Get image details first
    const imageResult = await db.query(
      'SELECT image_url FROM gallery WHERE gallery_id = $1',
      [galleryId]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found"
      });
    }

    const imageUrl = imageResult.rows[0].image_url;

    // Extract file path from URL
    const urlParts = imageUrl.split('/gallery/');
    if (urlParts.length > 1) {
      const filePath = `gallery/${urlParts[1]}`;

      // Delete from Supabase
      const { error } = await supabase.storage
        .from('tour-images')
        .remove([filePath]);

      if (error) {
        console.warn('⚠️  File deletion warning:', error.message);
        // Continue anyway - delete from DB
      }
    }

    // Delete from database
    await db.query('DELETE FROM gallery WHERE gallery_id = $1', [galleryId]);

    console.log("✅ Gallery image deleted");

    res.json({
      success: true,
      message: "Gallery image deleted successfully"
    });

  } catch (err) {
    console.error("deleteGalleryImage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete gallery image",
      error: err.message
    });
  }
};

/**
 * 6️⃣ REORDER GALLERY IMAGES
 * PATCH /api/admin/gallery/reorder
 */
export const reorderGalleryImages = async (req, res) => {
  try {
    const { images } = req.body; // [{ gallery_id, display_order }, ...]

    console.log("📊 Reordering gallery images");

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images array is required"
      });
    }

    // Update display order for each image
    for (const img of images) {
      await db.query(
        'UPDATE gallery SET display_order = $1, updated_at = NOW() WHERE gallery_id = $2',
        [img.display_order, img.gallery_id]
      );
    }

    console.log("✅ Gallery images reordered");

    res.json({
      success: true,
      message: "Gallery images reordered successfully",
      count: images.length
    });

  } catch (err) {
    console.error("reorderGalleryImages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to reorder gallery images",
      error: err.message
    });
  }
};

/**
 * 7️⃣ GET GALLERY STATISTICS
 * GET /api/admin/gallery/stats
 */
export const getGalleryStats = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_images,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_images,
        COUNT(CASE WHEN is_featured = true THEN 1 END) as featured_images,
        COUNT(DISTINCT category) as total_categories
      FROM gallery
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      stats
    });

  } catch (err) {
    console.error("getGalleryStats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gallery statistics",
      error: err.message
    });
  }
};

export default {
  getAllGalleryImages,
  getGalleryCategories,
  uploadGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  reorderGalleryImages,
  getGalleryStats
};
