import { NotificationService } from '../src/utils/notificationService.js';
import db from '../src/config/db.js';

const finalVerification = async () => {
    const email = 'kdilshanbandara5712@gmail.com';
    const phone = '+94760811862';
    
    try {
        // Update DB to the requested phone number first
        await db.query('UPDATE tourist SET phone = $1 WHERE user_id = (SELECT user_id FROM users WHERE email = $2)', [phone, email]);
        console.log(`✅ Database updated for ${email} to ${phone}`);

        const userRes = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
        const userId = userRes.rows[0].user_id;

        console.log(`🚀 Sending final verification SMS...`);
        
        await NotificationService.create({
            userId: userId,
            type: 'booking',
            title: 'I GO LANKA Verification',
            message: 'Your system is now LIVE! SMS and Email are working in parallel. ✅',
            sendEmailNotif: true, // Send both for final check
            emailData: {
                packageName: 'Live Verification',
                bookingId: 'LIVE-OK'
            }
        });
        
        console.log('🏁 Final test completed. Please check BOTH your email and phone!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
};

finalVerification();
