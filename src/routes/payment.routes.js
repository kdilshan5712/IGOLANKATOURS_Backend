/**
 * Payment Internal & Stripe Integration Routes
 * Path: /api/payments
 * 
 * Orchestrates the financial workflow, including payment intent creation, 
 * confirmation, refunds, and handling Stripe webhooks for asynchronous status updates.
 */
import express from 'express';
import {
    createPaymentIntent,
    confirmPayment,
    processRefund,
    getPaymentHistory,
    webhookHandler,
    processDummyPayment,
    generatePayHereHash,
    payhereWebhook,
    verifyPayHerePayment
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
 * @route   POST /api/payments/payhere/hash
 * @desc    Generate MD5 hash for PayHere checkout
 * @access  Private
 */
router.post('/payhere/hash', authenticate, generatePayHereHash);

/**
 * @route   POST /api/payments/payhere/webhook
 * @desc    PayHere webhook endpoint for asynchronous confirmation
 * @access  Public (PayHere only)
 */
router.post('/payhere/webhook', payhereWebhook);

/**
 * @route   GET /api/payments/payhere/verify/:orderId
 * @desc    Verify a PayHere payment via REST API using App ID + App Secret
 * @access  Private
 */
router.get('/payhere/verify/:orderId', authenticate, verifyPayHerePayment);

export default router;
