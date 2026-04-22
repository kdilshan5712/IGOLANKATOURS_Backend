import db from "../config/db.js";
import pricingService from "../services/pricing.service.js";

/**
 * Retrieves all active tour packages with optional filtering and pagination.
 * Calculates dynamic "From" pricing based on the current season for each package.
 * 
 * @async
 * @function getAllPackages
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.category] - Filter by category (Cultural, Beach, etc.).
 * @param {string} [req.query.budget] - Filter by budget level ('budget', 'mid', 'luxury').
 * @param {number} [req.query.min_price] - Minimum base price.
 * @param {number} [req.query.max_price] - Maximum base price.
 * @param {string} [req.query.search] - Search term for name/description.
 * @param {number} [req.query.limit=50] - Number of records per page.
 * @param {number} [req.query.offset=0] - Pagination offset.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with filtered packages and total count.
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
        base_price as price,
        duration,
        category,
        budget,
        hotel,
        rating,
        image,
        season_type,
        coast_type
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
      query += ` AND base_price >= $${paramIndex}`;
      params.push(parseFloat(min_price));
      paramIndex++;
    }

    // Filter by maximum price
    if (max_price) {
      query += ` AND base_price <= $${paramIndex}`;
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
    query += ` ORDER BY rating DESC, base_price ASC`;

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
      countQuery += ` AND base_price >= $${countParamIndex}`;
      countParams.push(parseFloat(min_price));
      countParamIndex++;
    }
    if (max_price) {
      countQuery += ` AND base_price <= $${countParamIndex}`;
      countParams.push(parseFloat(max_price));
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND (name ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Calculate dynamic "From" price for each package (using today's date)
    const today = new Date();
    const packagesWithPricing = await Promise.all(result.rows.map(async (pkg) => {
      const pricing = await pricingService.calculateDynamicPrice(
        { ...pkg, base_price: pkg.price }, // pkg.price is aliased base_price
        today
      );
      return {
        ...pkg,
        currentPrice: pricing.pricePerPerson,
        seasonLabel: pricing.seasonLabel,
        isDynamic: pkg.season_type !== 'year_round'
      };
    }));

    res.json({
      success: true,
      count: packagesWithPricing.length,
      total: totalCount,
      packages: packagesWithPricing
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Caught and sent to the global error middleware in server.js
    console.error("❌ Get packages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve packages"
    });
  }
};

/**
 * Retrieves full details for a single tour package by its ID.
 * Includes parsed itinerary, inclusion lists, and comprehensive review statistics.
 * 
 * @async
 * @function getPackageById
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - UUID of the package.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with complete package data and review stats.
 */
export const getPackageById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID format to prevent database syntax errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid package ID format. Expected a UUID."
    });
  }

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
        base_price as price,
        duration,
        category,
        budget,
        hotel,
        rating,
        image,
        itinerary,
        images,
        created_at,
        season_type,
        coast_type
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

    // Calculate pricing for today
    const today = new Date();
    const pricing = await pricingService.calculateDynamicPrice(
      { ...packageData, base_price: packageData.price },
      today
    );

    res.json({
      success: true,
      package: {
        ...packageData,
        pricing: {
          ...pricing,
          note: "Price calculated for travel today. Select date for exact pricing."
        },
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
    // @ERROR_PROPAGATION: Handled by centralized error handler
    console.error("❌ Get package error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve package"
    });
  }
};

/**
 * Retrieves a list of featured tour packages based on high user ratings.
 * 
 * @async
 * @function getFeaturedPackages
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {number} [req.query.limit=10] - Max number of featured packages to return.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with featured packages.
 */
export const getFeaturedPackages = async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const result = await db.query(
      `SELECT 
        package_id,
        name,
        description,
        base_price as price,
        duration,
        category,
        budget,
        hotel,
        rating,
        image,
        season_type,
        coast_type
      FROM tour_packages
      WHERE is_active = true AND rating >= 4.8
      ORDER BY rating DESC, base_price ASC
      LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      count: result.rows.length,
      packages: result.rows
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Handled by server.js
    console.error("❌ Get featured packages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve featured packages"
    });
  }
};

/**
 * Retrieves a list of unique categories used across all active tour packages.
 * 
 * @async
 * @function getCategories
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of categories.
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
 * Retrieves aggregated statistics about available tour packages, 
 * including counts by category, budget, and price ranges.
 * 
 * @async
 * @function getPackageStats
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with package statistics.
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
        MIN(base_price) as min_price,
        MAX(base_price) as max_price,
        AVG(base_price) as avg_price,
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

/**
 * Calculates the precise price for a package given a specific travel date and traveler count.
 * Accounts for seasonal variations and group size adjustments.
 * 
 * @async
 * @function calculatePackagePrice
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - UUID of the package.
 * @param {Object} req.query - Query parameters.
 * @param {string} req.query.date - Planned travel date (YYYY-MM-DD).
 * @param {number} [req.query.adults] - Number of adult travelers.
 * @param {number} [req.query.children] - Number of child travelers.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the calculated dynamic pricing.
 */
export const calculatePackagePrice = async (req, res) => {
  const { id } = req.params;
  // Default to 1 adult if nothing provided. children default to 0.
  // if travelers is provided (old way), treat as adults (or total). 
  // But better to use adults/children explicit.
  const { date, travelers, adults, children } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Date is required"
    });
  }

  // Backwards compatibility: if 'travelers' is passed but 'adults' is not, use travelers as adults
  const numAdults = adults ? parseInt(adults) : (travelers ? parseInt(travelers) : 1);
  const numChildren = children ? parseInt(children) : 0;

  try {
    const result = await db.query(
      `SELECT package_id, base_price as price, season_type, coast_type 
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

    const pkg = result.rows[0];
    const pricing = await pricingService.calculateDynamicPrice(
      { ...pkg, base_price: pkg.price },
      date,
      numAdults,
      numChildren
    );

    res.json({
      success: true,
      pricing
    });

  } catch (err) {
    // @ERROR_PROPAGATION: Logged and forwarded to global handler
    console.error("❌ Calculate price error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to calculate price"
    });
  }
};
