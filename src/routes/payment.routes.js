import express from 'express';
import {
    createPaymentIntent,
    confirmPayment,
    processRefund,
    getPaymentHistory,
    webhookHandler,
    processDummyPayment
} from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a payment intent for a booking
 * @access  Private
 */
router.post('/create-intent', authenticate, createPaymentIntent);

/**
 * @route   POST /api/payments/process-dummy
 * @desc    Process a dummy payment (Mock)
 * @access  Private
 */
router.post('/process-dummy', authenticate, processDummyPayment);

/**
 * @route   POST /api/payments/confirm
 * @desc    Confirm payment completion
 * @access  Private
 */
router.post('/confirm', authenticate, confirmPayment);

/**
 * @route   POST /api/payments/refund
 * @desc    Process refund for cancelled booking
 * @access  Private (Admin only in production)
 */
router.post('/refund', authenticate, processRefund);

/**
 * @route   GET /api/payments/history/:userId
 * @desc    Get payment history for a user
 * @access  Private
 */
router.get('/history/:userId', authenticate, getPaymentHistory);

/**
 * @route   POST /api/payments/webhook
 * @desc    Stripe webhook endpoint
 * @access  Public (Stripe only)
 * @note    This route should NOT use authenticateToken middleware
 */
router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

export default router;
