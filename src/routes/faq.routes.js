/**
 * Frequently Asked Questions (FAQ) Routes
 * Path: /api/faqs
 * 
 * Provides public endpoints for retrieving frequently asked questions.
 */
import express from 'express';
import { getAllFaqs } from '../controllers/faq.controller.js';

const router = express.Router();

// Public route to fetch FAQs
router.get('/', getAllFaqs);

export default router;
