import { NotificationService } from '../src/utils/notificationService.js';
import db from '../src/config/db.js';

const testSms = async () => {
    // Replace with a valid user_id from your tourist or tour_guide table
    // I found this one in your DB: 0dcd27dd-35a6-4446-9914-6fd20b3ba4b8
    const userId = '0dcd27dd-35a6-4446-9914-6fd20b3ba4b8'; 
    const type = 'booking';
    
    console.log(`🚀 Sending test SMS for event: ${type}...`);
    
    try {
        await NotificationService.create({
            userId: userId,
            type: type,
            title: 'Booking Confirmed!',
            message: 'Your booking for the Dream Tour has been confirmed.',
            sendEmailNotif: false, // Skip email for this test
            emailData: {
                packageName: 'Dream Tour',
                bookingId: 'BK-12345'
            }
        });
        
        console.log('✅ Notification created and SMS attempt logged.');
        console.log('Check your phone (if the number is verified in Twilio)!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        process.exit();
    }
};

testSms();
