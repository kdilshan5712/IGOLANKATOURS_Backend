import db from "../config/db.js";

/**
 * GET ALL PACKAGES (PUBLIC - No auth required)
 * GET /api/packages
 * 
 * Query Parameters:
 * - category: Filter by category (Cultural, Beach, Wildlife, Adventure, Luxury)
 * - budget: Filter by budget type (budget, mid, luxury)
 * - min_price: Minimum price filter
 * - max_price: Maximum price filter
 * - search: Search in name and description
 * - limit: Number of results per page (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export const getAllPackages = async (req, res) => {
  const { 
    category, 
    budget, 
    min_price, 
    max_price, 
    search,
    limit = 50,
    offset = 0
  } = req.query;

  try {
    let query = `
      SELECT 
        package_id,
        name,
        description,
        price,
        duration,
        category,
        budget,
        hotel,
        rating,
        image
      FROM tour_packages
      WHERE is_active = true
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by category
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Filter by budget
    if (budget) {
      query += ` AND budget = $${paramIndex}`;
      params.push(budget);
      paramIndex++;
    }

    // Filter by minimum price
    if (min_price) {
      query += ` AND price >= $${paramIndex}`;
      params.push(parseFloat(min_price));
      paramIndex++;
    }

    // Filter by maximum price
    if (max_price) {
      query += ` AND price <= $${paramIndex}`;
      params.push(parseFloat(max_price));
      paramIndex++;
    }

    // Search by name or description (case-insensitive)
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Order by rating DESC, then price ASC
    query += ` ORDER BY rating DESC, price ASC`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM tour_packages WHERE is_active = true`;
    const countParams = [];
    let countParamIndex = 1;

    if (category) {
      countQuery += ` AND category = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }
    if (budget) {
      countQuery += ` AND budget = $${countParamIndex}`;
      countParams.push(budget);
      countParamIndex++;
    }
    if (min_price) {
      countQuery += ` AND price >= $${countParamIndex}`;
      countParams.push(parseFloat(min_price));
      countParamIndex++;
    }
    if (max_price) {
      countQuery += ` AND price <= $${countParamIndex}`;
      countParams.push(parseFloat(max_price));
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND (name ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      count: result.rows.length,
      total: totalCount,
      packages: result.rows
    });

  } catch (err) {
    console.error("❌ Get packages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve packages"
    });
  }
};

/**
 * GET SINGLE PACKAGE BY ID (PUBLIC - No auth required)
 * GET /api/packages/:id
 * 
 * Returns full package details for the package detail page
 */
export const getPackageById = async (req, res) => {
  const { id } = req.params;

  // No validation needed - PostgreSQL will handle UUID format

  try {
    // Fetch package details
    const result = await db.query(
      `SELECT 
        package_id,
        name,
        description,
        full_description AS "fullDescription",
        highlights,
        includes AS included,
        excludes AS "notIncluded",
        price,
        duration,
        category,
        budget,
        hotel,
        rating,
        image,
        itinerary,
        images,
        created_at
      FROM tour_packages
      WHERE package_id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    // Parse JSON fields if they exist
    const packageData = result.rows[0];
    if (packageData.highlights && typeof packageData.highlights === 'string') {
      try {
        packageData.highlights = JSON.parse(packageData.highlights);
      } catch (e) {
        packageData.highlights = packageData.highlights.split('\n').filter(h => h.trim());
      }
    }
    if (packageData.included && typeof packageData.included === 'string') {
      try {
        packageData.included = JSON.parse(packageData.included);
      } catch (e) {
        packageData.included = packageData.included.split('\n').filter(h => h.trim());
      }
    }
    if (packageData.notIncluded && typeof packageData.notIncluded === 'string') {
      try {
        packageData.notIncluded = JSON.parse(packageData.notIncluded);
      } catch (e) {
        packageData.notIncluded = packageData.notIncluded.split('\n').filter(h => h.trim());
      }
    }

    // Itinerary is already JSONB, images is already TEXT[] - no parsing needed

    // Fetch review statistics
    const reviewStatsResult = await db.query(
      `SELECT 
        COUNT(*) as total_reviews,
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
        COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
        COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
        COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
        COUNT(*) FILTER (WHERE rating = 1) as one_star_count
      FROM reviews
      WHERE package_id = $1 AND status = 'approved'`,
      [id]
    );

    const reviewStats = reviewStatsResult.rows[0];

    // Fetch latest 3 approved reviews
    const latestReviewsResult = await db.query(
      `SELECT 
        r.review_id,
        r.rating,
        r.comment,
        r.images,
        r.created_at,
        t.full_name as reviewer_name
      FROM reviews r
      JOIN tourist t ON r.user_id = t.user_id
      WHERE r.package_id = $1 AND r.status = 'approved'
      ORDER BY r.created_at DESC
      LIMIT 3`,
      [id]
    );

    // Collect review images for gallery (max 10)
    const reviewImagesResult = await db.query(
      `SELECT DISTINCT unnest(images) as image_url
      FROM reviews
      WHERE package_id = $1 AND status = 'approved' AND images IS NOT NULL
      LIMIT 10`,
      [id]
    );

    const reviewImages = reviewImagesResult.rows.map(row => row.image_url);

    res.json({
      success: true,
      package: {
        ...packageData,
        reviewStats: {
          totalReviews: parseInt(reviewStats.total_reviews),
          averageRating: parseFloat(reviewStats.average_rating).toFixed(1),
          ratingDistribution: {
            5: parseInt(reviewStats.five_star_count),
            4: parseInt(reviewStats.four_star_count),
            3: parseInt(reviewStats.three_star_count),
            2: parseInt(reviewStats.two_star_count),
            1: parseInt(reviewStats.one_star_count)
          }
        },
        latestReviews: latestReviewsResult.rows,
        reviewImages: reviewImages
      }
    });

  } catch (err) {
    console.error("❌ Get package error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve package"
    });
  }
};

/**
 * GET FEATURED PACKAGES (PUBLIC)
 * GET /api/packages/featured
 * 
 * Returns top-rated packages (rating >= 4.8)
 * Used for homepage or featured sections
 */
export const getFeaturedPackages = async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const result = await db.query(
      `SELECT 
        package_id,
        name,
        description,
        price,
        duration,
        category,
        budget,
        hotel,
        rating,
        image
      FROM tour_packages
      WHERE is_active = true AND rating >= 4.8
      ORDER BY rating DESC, price ASC
      LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      count: result.rows.length,
      packages: result.rows
    });

  } catch (err) {
    console.error("❌ Get featured packages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve featured packages"
    });
  }
};

/**
 * GET PACKAGE CATEGORIES (PUBLIC)
 * GET /api/packages/categories
 * 
 * Returns unique categories for filtering UI
 */
export const getCategories = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT category 
       FROM tour_packages 
       WHERE is_active = true
       ORDER BY category`
    );

    const categories = result.rows.map(row => row.category);

    res.json({
      success: true,
      categories
    });

  } catch (err) {
    console.error("❌ Get categories error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories"
    });
  }
};

/**
 * GET PACKAGE STATS (PUBLIC)
 * GET /api/packages/stats
 * 
 * Returns statistics about packages (total, by category, price ranges)
 */
export const getPackageStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_packages,
        COUNT(CASE WHEN category = 'Cultural' THEN 1 END) as cultural_count,
        COUNT(CASE WHEN category = 'Beach' THEN 1 END) as beach_count,
        COUNT(CASE WHEN category = 'Wildlife' THEN 1 END) as wildlife_count,
        COUNT(CASE WHEN category = 'Adventure' THEN 1 END) as adventure_count,
        COUNT(CASE WHEN category = 'Luxury' THEN 1 END) as luxury_count,
        COUNT(CASE WHEN budget = 'budget' THEN 1 END) as budget_count,
        COUNT(CASE WHEN budget = 'mid' THEN 1 END) as mid_count,
        COUNT(CASE WHEN budget = 'luxury' THEN 1 END) as luxury_budget_count,
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price) as avg_price,
        AVG(rating) as avg_rating
      FROM tour_packages
      WHERE is_active = true
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        total_packages: parseInt(stats.total_packages),
        by_category: {
          Cultural: parseInt(stats.cultural_count),
          Beach: parseInt(stats.beach_count),
          Wildlife: parseInt(stats.wildlife_count),
          Adventure: parseInt(stats.adventure_count),
          Luxury: parseInt(stats.luxury_count)
        },
        by_budget: {
          budget: parseInt(stats.budget_count),
          mid: parseInt(stats.mid_count),
          luxury: parseInt(stats.luxury_budget_count)
        },
        price_range: {
          min: parseFloat(stats.min_price),
          max: parseFloat(stats.max_price),
          avg: parseFloat(stats.avg_price).toFixed(2)
        },
        avg_rating: parseFloat(stats.avg_rating).toFixed(1)
      }
    });

  } catch (err) {
    console.error("❌ Get package stats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve package statistics"
    });
  }
};
