import { sendSMS } from '../src/utils/smsService.js';

const ultimatum = async () => {
    console.log('🚀 ULTIMATUM TEST START...');
    const phone = '+94760811862'; // From your screenshot
    
    try {
        const result = await sendSMS(phone, 'ULTIMATUM TEST: This is directly from the SMS service logic. ✅', 'test');
        console.log('🎬 TWILIO RESPONSE:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('💥 CRITICAL ERROR:', e);
    } finally {
        process.exit();
    }
};

ultimatum();
