import { NotificationService } from '../src/utils/notificationService.js';
import db from '../src/config/db.js';

const testUserSms = async () => {
    const email = 'kdilshanbandara5712@gmail.com';
    
    try {
        const userRes = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            console.error(`❌ User not found with email: ${email}`);
            return;
        }
        
        const userId = userRes.rows[0].user_id;
        console.log(`👤 Found user_id: ${userId}`);
        
        console.log(`🚀 Sending sample SMS notification...`);
        
        await NotificationService.create({
            userId: userId,
            type: 'booking',
            title: 'Test SMS Verification 🚀',
            message: 'Your I GO LANKA TOURS SMS notification system is working! ✅',
            sendEmailNotif: false,
            emailData: {
                packageName: 'Verification Pack',
                bookingId: 'TEST-OK'
            }
        });
        
        console.log('✅ SMS attempt completed. Please check your phone!');
    } catch (error) {
        console.error('❌ Error during test:', error.message);
    } finally {
        process.exit();
    }
};

testUserSms();
