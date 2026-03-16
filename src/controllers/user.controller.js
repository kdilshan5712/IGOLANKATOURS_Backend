import db from "../config/db.js";
import supabase from "../config/supabase.js";

/**
 * GET USER PROFILE
 * GET /api/user/me
 * Auth: Required (Tourist only)
 */
export const getUserProfile = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await db.query(
      `SELECT 
        u.user_id,
        u.email,
        u.role,
        u.created_at,
        t.full_name,
        t.phone,
        t.country
      FROM users u
      LEFT JOIN tourist t ON u.user_id = t.user_id
      WHERE u.user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const profile = result.rows[0];

    // Split full_name into first_name and last_name for frontend compatibility
    if (profile.full_name) {
      const nameParts = profile.full_name.split(' ');
      profile.first_name = nameParts[0] || '';
      profile.last_name = nameParts.slice(1).join(' ') || '';
    } else {
      profile.first_name = '';
      profile.last_name = '';
    }

    return res.json({
      message: "Profile retrieved successfully",
      profile
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};

/**
 * GET USER BOOKINGS
 * GET /api/user/bookings
 * Auth: Required (Tourist only)
 */
export const getUserBookings = async (req, res) => {
  const user_id = req.user.user_id;

  console.log("📋 [GET /api/user/bookings] Authenticated user_id:", user_id);
  console.log("📋 [GET /api/user/bookings] User role:", req.user.role);

  try {
    const result = await db.query(
      `SELECT 
        b.booking_id,
        b.user_id,
        b.package_id,
        b.travel_date,
        b.travelers,
        b.total_price,
        b.status,
        b.created_at,
        p.name as package_name,
        p.duration,
        p.image,
        p.category
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
      [user_id]
    );

    console.log("📋 [GET /api/user/bookings] Query executed successfully");
    console.log("📋 [GET /api/user/bookings] Found bookings:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("📋 [GET /api/user/bookings] First booking:", JSON.stringify(result.rows[0], null, 2));
    }

    return res.json({
      message: "Bookings retrieved successfully",
      bookings: result.rows
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      message: "Failed to fetch bookings",
      error: error.message
    });
  }
};

/**
 * UPLOAD PROFILE PHOTO
 * POST /api/user/profile-photo
 * Auth: Required (Tourist only)
 */
export const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, message: "File must be an image" });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Image size must be less than 5MB" });
    }

    // Get old profile photo to delete later
    const touristResult = await db.query(
      `SELECT profile_photo FROM tourist WHERE user_id = $1`,
      [userId]
    );

    if (touristResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tourist profile not found" });
    }

    const oldPhotoPath = touristResult.rows[0].profile_photo;

    const fileExt = file.originalname.split('.').pop();
    const fileName = `tourist-${userId}-${Date.now()}.${fileExt}`;
    const filePath = `tourist-photos/${fileName}`;

    const { data, error } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ success: false, message: "Failed to upload photo to storage", detail: error.message });
    }

    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    const photoUrl = urlData?.publicUrl || filePath;

    await db.query(
      `UPDATE tourist SET profile_photo = $1 WHERE user_id = $2`,
      [photoUrl, userId]
    );

    // Clean up old photo safely
    if (oldPhotoPath && oldPhotoPath.includes('profile-photos/')) {
      try {
        const oldPathRaw = oldPhotoPath.split('profile-photos/')[1];
        await supabase.storage.from("profile-photos").remove([oldPathRaw]);
      } catch (err) {
        console.error("Failed to delete old tourist photo:", err);
      }
    }

    res.json({ success: true, message: "Profile photo uploaded successfully", profile_photo: photoUrl });
  } catch (err) {
    console.error("❌ uploadProfilePhoto error:", err);
    res.status(500).json({ success: false, message: "Failed to upload profile photo" });
  }
};

/**
 * DELETE PROFILE PHOTO
 * DELETE /api/user/profile-photo
 * Auth: Required (Tourist only)
 */
export const deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const touristResult = await db.query(
      `SELECT profile_photo FROM tourist WHERE user_id = $1`,
      [userId]
    );

    if (touristResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tourist profile not found" });
    }

    const photoPath = touristResult.rows[0].profile_photo;

    if (!photoPath) {
      return res.status(400).json({ success: false, message: "No profile photo to delete" });
    }

    if (photoPath.includes('profile-photos/')) {
      try {
        const oldPathRaw = photoPath.split('profile-photos/')[1];
        const { error } = await supabase.storage.from("profile-photos").remove([oldPathRaw]);
        if (error) console.error("Failed to delete photo from storage:", error);
      } catch (err) { }
    }

    await db.query(
      `UPDATE tourist SET profile_photo = NULL WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, message: "Profile photo deleted successfully" });
  } catch (err) {
    console.error("❌ deleteProfilePhoto error:", err);
    res.status(500).json({ success: false, message: "Failed to delete profile photo" });
  }
};
