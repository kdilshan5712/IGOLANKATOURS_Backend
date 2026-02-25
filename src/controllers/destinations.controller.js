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
