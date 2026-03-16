import express from 'express';
import { saveChatbotSession } from '../controllers/ai.controller.js';

const router = express.Router();

/**
 * AI ROUTES
 * Note: The main /chat, /weather, /recommend routes are proxied to the Python service in server.js.
 * These routes are for side-effects like saving sessions to the database.
 */

router.post('/session', saveChatbotSession);

export default router;
