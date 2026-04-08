import express from 'express';
import { saveChatbotSession, submitCustomTourRequest, syncChatHistory } from '../controllers/ai.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { contactSchemas } from '../schemas/contact.schema.js';
import { aiSchemas } from '../schemas/ai.schema.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * AI ROUTES
 * Note: The main /chat, /weather, /recommend routes are proxied to the Python service in server.js.
 * These routes are for side-effects like saving sessions to the database.
 */

router.post('/session', aiSchemas.saveSession, validate, saveChatbotSession);
router.post('/submit-custom-tour', authenticate, contactSchemas.customTour, validate, submitCustomTourRequest);
router.post('/sync-history', authenticate, aiSchemas.syncHistory, validate, syncChatHistory);

export default router;
