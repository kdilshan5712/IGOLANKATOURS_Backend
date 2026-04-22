import db from '../config/db.js';

/**
 * Retrieves all destinations from the database, ordered alphabetically by name.
 * 
 * @async
 * @function getAllDestinations
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of destinations.
 */
export const getAllDestinations = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM destinations ORDER BY name ASC');
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching destinations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch destinations'
        });
    }
};

/**
 * Creates a new destination in the database.
 * 
 * @async
 * @function createDestination
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Destination details.
 * @param {string} req.body.name - Name of the destination.
 * @param {string} req.body.category - Category (e.g., Beach, Nature).
 * @param {string} req.body.description - Detailed description.
 * @param {string} req.body.image_url - URL for the destination's primary image.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created destination.
 */
export const createDestination = async (req, res) => {
    const { name, category, description, image_url } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO destinations (name, category, description, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, category, description, image_url]
        );
        res.status(201).json({
            success: true,
            message: 'Destination created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating destination:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create destination'
        });
    }
};

/**
 * Updates an existing destination's information.
 * 
 * @async
 * @function updateDestination
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the destination to update.
 * @param {Object} req.body - Updated destination data.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated destination.
 */
export const updateDestination = async (req, res) => {
    const { id } = req.params;
    const { name, category, description, image_url } = req.body;
    try {
        const result = await db.query(
            'UPDATE destinations SET name = $1, category = $2, description = $3, image_url = $4 WHERE destination_id = $5 RETURNING *',
            [name, category, description, image_url, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Destination not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Destination updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating destination:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update destination'
        });
    }
};

/**
 * Deletes a destination from the database.
 * 
 * @async
 * @function deleteDestination
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.id - ID of the destination to delete.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion.
 */
export const deleteDestination = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM destinations WHERE destination_id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Destination not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Destination deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting destination:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete destination'
        });
    }
};
