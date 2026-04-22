/**
 * Email Dispatcher Re-export
 * Consolidates the core email sending function and branded templates for easier import.
 */
import { sendEmail } from './emailService.js';
import { emailTemplates } from './emailTemplates.js';

export { sendEmail, emailTemplates };
