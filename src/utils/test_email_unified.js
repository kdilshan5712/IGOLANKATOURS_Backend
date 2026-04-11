import dotenv from 'dotenv';
import { sendEmail, emailTemplates } from './sendEmail.js';

dotenv.config();

/**
 * TEST EMAIL SENDER
 * This script verifies that the unified branding is correctly applied
 * and that the email transport is functioning.
 */

const testEmail = async () => {
  const recipient = 'kdilshanbandara5712@gmail.com';
  
  console.log(`🚀 Starting test email transmission to: ${recipient}`);
  
  try {
    // We'll use the Welcome template to test the branding
    const template = emailTemplates.touristWelcome('Dilshan Bandara');
    
    console.log(`📝 Template generated: ${template.subject}`);
    
    const result = await sendEmail(recipient, template.subject, template.html);
    
    if (result) {
      console.log('✅ Success! The test email has been sent.');
      console.log('Check your inbox for the premium I GO LANKA TOURS branding.');
    } else {
      console.error('❌ Failed! Email utility returned false.');
      console.log('Check your .env settings (EMAIL_HOST, EMAIL_USER, etc.)');
    }
  } catch (error) {
    console.error('❌ Error occurred during email test:', error.message);
  }
};

testEmail();
