import express from 'express';
import { getAllFaqs } from '../controllers/faq.controller.js';

const router = express.Router();

// Public route to fetch FAQs
router.get('/', getAllFaqs);

export default router;
