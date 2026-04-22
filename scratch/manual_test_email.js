import 'dotenv/config';
import { sendEmail } from '../src/utils/emailService.js';

async function sendManualTest() {
    const to = 'kdilshanbandara5712@gmail.com';
    const subject = 'Test Email - I GO LANKA TOURS Final Check';
    const body = `
        <h1>Live Test Email</h1>
        <p>This is a manual test email sent after the Azure deployment fix.</p>
        <p>Sender Format: ${process.env.EMAIL_FROM}</p>
        <p>Status: <strong>WORKING</strong></p>
    `;

    console.log(`🚀 Sending manual test email to ${to}...`);
    console.log(`📧 Expected From: ${process.env.EMAIL_FROM}`);
    try {
        const result = await sendEmail(to, subject, body);
        if (result.success) {
            console.log('✅ Email sent successfully!');
            console.log('Message ID:', result.messageId);
        } else {
            console.error('❌ Failed to send email:', result.error);
        }
    } catch (error) {
        console.error('🔥 Error:', error.message);
    } finally {
        process.exit();
    }
}

sendManualTest();
