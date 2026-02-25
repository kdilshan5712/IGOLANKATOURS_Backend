import supabase from "../config/supabase.js";
import db from "../config/db.js";
import { hashPassword } from "../utils/hash.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail, emailTemplates } from "../utils/sendEmail.js";

/* ======================================================
   GET GUIDE DASHBOARD STATISTICS
   GET /api/guide/dashboard/stats
   ====================================================== */
export const getGuideDashboardStats = async (req, res) => {
    try {
        const guideId = req.user.user_id;

        console.log(`[GUIDE] Fetching dashboard stats for guide: ${guideId}`);

        // Get total tours assigned
        const toursResult = await db.query(
            `SELECT COUNT(*) as total_tours
       FROM bookings
       WHERE guide_id = $1`,
            [guideId]
        );

        // Get upcoming tours (future tours that are confirmed or pending)
        const upcomingResult = await db.query(
            `SELECT COUNT(*) as upcoming_tours
       FROM bookings
       WHERE guide_id = $1
       AND tour_date > CURRENT_DATE
       AND status IN ('confirmed', 'pending')`,
            [guideId]
        );

        // Get completed tours
        const completedResult = await db.query(
            `SELECT COUNT(*) as completed_tours
       FROM bookings
       WHERE guide_id = $1
       AND status = 'completed'`,
            [guideId]
        );

        // Get total earnings (sum of completed tour commissions)
        // Assuming guide gets 10% commission on total price
        const earningsResult = await db.query(
            `SELECT COALESCE(SUM(total_price * 0.10), 0) as total_earnings
       FROM bookings
       WHERE guide_id = $1
       AND status = 'completed'`,
            [guideId]
        );

        // Get average rating from reviews
        const ratingResult = await db.query(
            `SELECT COALESCE(AVG(r.rating), 0) as avg_rating,
              COUNT(r.review_id) as review_count
       FROM reviews r
       JOIN bookings b ON r.booking_id = b.booking_id
       WHERE b.guide_id = $1`,
            [guideId]
        );

        const stats = {
            totalTours: parseInt(toursResult.rows[0].total_tours) || 0,
            upcomingTours: parseInt(upcomingResult.rows[0].upcoming_tours) || 0,
            completedTours: parseInt(completedResult.rows[0].completed_tours) || 0,
            totalEarnings: parseFloat(earningsResult.rows[0].total_earnings) || 0,
            averageRating: parseFloat(ratingResult.rows[0].avg_rating).toFixed(1) || '0.0',
            reviewCount: parseInt(ratingResult.rows[0].review_count) || 0
        };

        console.log(`[GUIDE] Dashboard stats calculated:`, stats);

        res.json({
            success: true,
            stats
        });

    } catch (err) {
        console.error("[GUIDE] getDashboardStats error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics"
        });
    }
};
