import db from '../config/db.js';

/**
 * Retrieves the IDs of all tour packages in the authenticated tourist's wishlist.
 * 
 * @async
 * @function getUserWishlist
 * @param {Object} req - Express request object.
 * @param {Object} req.user - Authenticated tourist user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of wishlisted package IDs.
 */
export const getUserWishlist = async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const result = await db.query(
            `SELECT package_id FROM wishlists WHERE user_id = $1`,
            [user_id]
        );

        const wishlistIds = result.rows.map(row => row.package_id);

        return res.json({
            success: true,
            wishlistIds
        });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch wishlist",
            error: error.message
        });
    }
};

/**
 * Toggles a tour package in the user's wishlist (adds if missing, removes if present).
 * Validates the existence of the package before performing the toggle operation.
 * 
 * @async
 * @function toggleWishlistItem
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Metadata.
 * @param {string} req.body.package_id - UUID of the package to toggle.
 * @param {Object} req.user - Authenticated tourist user object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating the action taken ('added' or 'removed').
 */
export const toggleWishlistItem = async (req, res) => {
    const user_id = req.user.user_id;
    const { package_id } = req.body;

    if (!package_id) {
        return res.status(400).json({
            success: false,
            message: "Package ID is required"
        });
    }

    try {
        // Check if package exists
        const pkgCheck = await db.query('SELECT package_id FROM tour_packages WHERE package_id = $1', [package_id]);
        if (pkgCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Package not found" });
        }

        // Check if already in wishlist
        const checkResult = await db.query(
            'SELECT wishlist_id FROM wishlists WHERE user_id = $1 AND package_id = $2',
            [user_id, package_id]
        );

        if (checkResult.rows.length > 0) {
            // It exists -> Remove it
            await db.query(
                'DELETE FROM wishlists WHERE user_id = $1 AND package_id = $2',
                [user_id, package_id]
            );

            return res.json({
                success: true,
                message: "Removed from wishlist",
                action: "removed",
                package_id
            });
        } else {
            // Does not exist -> Add it
            await db.query(
                'INSERT INTO wishlists (user_id, package_id) VALUES ($1, $2)',
                [user_id, package_id]
            );

            return res.json({
                success: true,
                message: "Added to wishlist",
                action: "added",
                package_id
            });
        }
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update wishlist",
            error: error.message
        });
    }
};
