import { NotificationService } from '../src/utils/notificationService.js';
import db from '../src/config/db.js';

const directSmsCall = async () => {
    const userId = '0dcd27dd-35a6-4446-9914-6fd20b3ba4b8';
    const type = 'booking';
    
    console.log('🚀 Calling NotificationService.sendSMSNotification directly...');
    try {
        const result = await NotificationService.sendSMSNotification(userId, type, { 
            title: 'Direct Call', 
            message: 'Direct call test. Confirmed!',
            packageName: 'Direct Pack'
        });
        console.log('🏁 Result:', result);
    } catch (error) {
        console.error('🔥 Error:', error);
    } finally {
        process.exit();
    }
};

directSmsCall();
