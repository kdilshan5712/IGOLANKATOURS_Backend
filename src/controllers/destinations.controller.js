import db from '../config/db.js';

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
