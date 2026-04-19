import { NotificationService } from '../src/utils/notificationService.js';
import db from '../src/config/db.js';

const finalFixTest = async () => {
    const email = 'kdilshanbandara5712@gmail.com';
    const verifiedPhone = '+94760811862';
    
    try {
        console.log('🔄 Step 1: Updating DB with verified number...');
        await db.query(
            `UPDATE tourist SET phone = $1 
             WHERE user_id = (SELECT user_id FROM users WHERE email = $2)`,
            [verifiedPhone, email]
        );

        const userRes = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
        const userId = userRes.rows[0].user_id;

        console.log(`🚀 Step 2: Sending SMS to verified number: ${verifiedPhone}`);
        
        await NotificationService.create({
            userId: userId,
            type: 'booking',
            title: 'Booking Confirmed!',
            message: 'Your system is now LIVE and working! ✅',
            sendEmailNotif: false,
            emailData: {
                packageName: 'Verified Test',
                bookingId: 'CONFIRMED'
            }
        });
        
        console.log('✅ Step 3: Test complete. Check your phone!');
    } catch (error) {
        console.error('❌ Error during final fix:', error);
    } finally {
        process.exit();
    }
};

finalFixTest();
