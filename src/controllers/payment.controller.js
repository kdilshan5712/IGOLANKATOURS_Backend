import stripe from '../config/stripe.js';
import pool from '../config/db.js';

/**
 * Creates a Stripe payment intent for a specific booking.
 * Supports mock payment flow for testing environments when useMock is enabled.
 * 
 * @async
 * @function createPaymentIntent
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Payment details.
 * @param {string} req.body.bookingId - ID of the booking.
 * @param {number} req.body.amount - Amount to charge.
 * @param {string} [req.body.currency='usd'] - Currency code.
 * @param {boolean} [req.body.useMock] - Whether to use a mock payment logic.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with client secret or mock ID.
 */
export const createPaymentIntent = async (req, res) => {
    try {
        const { bookingId, amount, currency = 'usd', useMock } = req.body;

        // Validate input
        if (!bookingId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID and amount are required'
            });
        }

        // Verify booking exists
        const bookingResult = await pool.query(
            'SELECT * FROM bookings WHERE booking_id = $1',
            [bookingId]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const booking = bookingResult.rows[0];

        // MOCK PAYMENT FLOW (for testing)
        if (useMock) {
            const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Store mock payment record
            await pool.query(
                `INSERT INTO payments (
                    booking_id, stripe_payment_intent_id, amount, currency, status, payment_method
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [bookingId, mockId, amount, currency, 'pending', 'mock_card']
            );

            return res.json({
                success: true,
                clientSecret: 'mock_secret',
                paymentIntentId: mockId,
                isMock: true
            });
        }

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency.toLowerCase(),
            metadata: {
                bookingId: bookingId,
                bookingReference: booking.booking_reference
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Store payment record in database
        await pool.query(
            `INSERT INTO payments (
        booking_id, stripe_payment_intent_id, amount, currency, status, payment_method
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [bookingId, paymentIntent.id, amount, currency, 'pending', 'card']
        );

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment intent',
            error: error.message
        });
    }
};

/**
 * Confirms a payment by verifying the payment intent status.
 * Updates booking and payment records and triggers automated confirmation emails on success.
 * 
 * @async
 * @function confirmPayment
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Confirmation details.
 * @param {string} req.body.paymentIntentId - ID of the Stripe payment intent.
 * @param {string} req.body.bookingId - ID of the associated booking.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming the payment status.
 */
export const confirmPayment = async (req, res) => {
    try {
        const { paymentIntentId, bookingId } = req.body;

        if (!paymentIntentId || !bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Payment intent ID and booking ID are required'
            });
        }

        let status = 'pending';

        // Check if it's a mock payment
        if (paymentIntentId.startsWith('pi_mock_')) {
            console.log('Confirmed MOCK payment:', paymentIntentId);
            status = 'succeeded';
        } else {
            // Retrieve payment intent from Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            status = paymentIntent.status;
        }

        if (status === 'succeeded') {
            // Update payment record
            await pool.query(
                `UPDATE payments 
         SET status = $1
         WHERE stripe_payment_intent_id = $2`,
                ['completed', paymentIntentId]
            );

            // Update booking status to confirmed
            await pool.query(
                `UPDATE bookings 
         SET status = $1, payment_status = $2
         WHERE booking_id = $3`,
                ['confirmed', 'paid', bookingId]
            );

            // --- F013: Send Automated Email Confirmation/Receipt ---
            try {
                const { NotificationService } = await import('../utils/notificationService.js');
                const { sendBookingConfirmation } = await import('../utils/emailService.js');

                // 1. Fetch full details for the email
                const fullBookingRes = await pool.query(
                    `SELECT b.*, t.full_name as user_name, u.email as user_email, p.name as package_name
                     FROM bookings b
                     JOIN users u ON b.user_id = u.user_id
                     JOIN tourist t ON u.user_id = t.user_id
                     JOIN tour_packages p ON b.package_id = p.package_id
                     WHERE b.booking_id = $1`,
                    [bookingId]
                );

                if (fullBookingRes.rows.length > 0) {
                    const data = fullBookingRes.rows[0];
                    
                    // Create in-app notification
                    await NotificationService.create({
                        userId: data.user_id,
                        type: 'booking',
                        title: 'Payment Received! 🎉',
                        message: `We've received your payment for ${data.package_name}. Your booking is now confirmed.`,
                        link: `/dashboard/bookings/${bookingId}`,
                        sendEmailNotif: false // We'll send the branded email manually below
                    });

                    const bookingReference = String(data.booking_id).substring(0, 8).toUpperCase();
                    
                    // Send Branded Confirmation Email
                    await sendBookingConfirmation({
                        userEmail: data.user_email,
                        userName: data.user_name,
                        bookingReference: bookingReference,
                        packageName: data.package_name,
                        travelDate: data.travel_date,
                        totalPrice: data.total_price,
                        numberOfTravelers: data.travelers
                    });
                    
                    console.log(`[F013] Automated confirmation sent for booking ${bookingId}`);
                }
            } catch (notifyError) {
                console.error('[F013] Failed to send automated notification:', notifyError);
                // Don't fail the payment response if email fails
            }

            res.json({
                success: true,
                message: 'Payment confirmed successfully',
                paymentStatus: status
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Payment not completed',
                paymentStatus: status
            });
        }
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: error.message
        });
    }
};

/**
 * Processes a refund for a previously completed payment through Stripe.
 * Updates both the payment and booking records with refund details.
 * 
 * @async
 * @function processRefund
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Refund details.
 * @param {string} req.body.bookingId - ID of the booking to refund.
 * @param {number} [req.body.refundAmount] - Amount to refund (defaults to full payment).
 * @param {string} [req.body.reason] - Reason for the refund.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the refund transaction details.
 */
export const processRefund = async (req, res) => {
    try {
        const { bookingId, refundAmount, reason } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID is required'
            });
        }

        // Get payment record
        const paymentResult = await pool.query(
            `SELECT * FROM payments 
       WHERE booking_id = $1 AND status = 'completed' 
       ORDER BY created_at DESC LIMIT 1`,
            [bookingId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No completed payment found for this booking'
            });
        }

        const payment = paymentResult.rows[0];
        const amountToRefund = refundAmount || payment.amount;

        // Create refund with Stripe
        const refund = await stripe.refunds.create({
            payment_intent: payment.stripe_payment_intent_id,
            amount: Math.round(amountToRefund * 100), // Convert to cents
            reason: reason || 'requested_by_customer',
            metadata: {
                bookingId: bookingId
            }
        });

        // Update payment record
        await pool.query(
            `UPDATE payments 
       SET status = $1, refund_amount = $2, refund_id = $3, updated_at = NOW() 
       WHERE payment_id = $4`,
            ['refunded', amountToRefund, refund.id, payment.payment_id]
        );

        // Update booking
        await pool.query(
            `UPDATE bookings 
       SET payment_status = $1, refund_amount = $2, updated_at = NOW() 
       WHERE booking_id = $3`,
            ['refunded', amountToRefund, bookingId]
        );

        res.json({
            success: true,
            message: 'Refund processed successfully',
            refundId: refund.id,
            refundAmount: amountToRefund,
            refundStatus: refund.status
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund',
            error: error.message
        });
    }
};

/**
 * Retrieves the payment transaction history for a specific user.
 * 
 * @async
 * @function getPaymentHistory
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.userId - ID of the user.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the user's payment records.
 */
export const getPaymentHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            `SELECT 
        p.*,
        b.booking_reference,
        b.travel_date,
        pkg.name as package_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       LEFT JOIN packages pkg ON b.package_id = pkg.package_id
       WHERE b.user_id = $1
       ORDER BY p.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            payments: result.rows
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history',
            error: error.message
        });
    }
};


/**
 * Processes a simulated (dummy) payment for testing without using Stripe.
 * Directly confirms the booking and sends confirmation emails.
 * 
 * @async
 * @function processDummyPayment
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Payment details.
 * @param {string} req.body.bookingId - ID of the booking.
 * @param {number} req.body.amount - Amount to process.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the dummy transaction ID.
 */
export const processDummyPayment = async (req, res) => {
    try {
        const { bookingId, amount } = req.body;

        if (!bookingId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID and amount are required'
            });
        }

        // Generate a fake transaction ID
        const transactionId = `dummy_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store mock payment record
        await pool.query(
            `INSERT INTO payments (
                booking_id, stripe_payment_intent_id, amount, currency, status, payment_method
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [bookingId, transactionId, amount, 'usd', 'completed', 'dummy_gateway']
        );

        // Update booking status to confirmed/paid
        await pool.query(
            `UPDATE bookings 
             SET status = 'confirmed', payment_status = 'paid'
             WHERE booking_id = $1`,
            [bookingId]
        );

        // --- F013: Send Automated Email Confirmation/Receipt (Mock) ---
        try {
            const { NotificationService } = await import('../utils/notificationService.js');
            const { sendBookingConfirmation } = await import('../utils/emailService.js');

            const fullBookingRes = await pool.query(
                `SELECT b.*, t.full_name as user_name, u.email as user_email, p.name as package_name
                 FROM bookings b
                 JOIN users u ON b.user_id = u.user_id
                 JOIN tourist t ON u.user_id = t.user_id
                 JOIN tour_packages p ON b.package_id = p.package_id
                 WHERE b.booking_id = $1`,
                [bookingId]
            );

            if (fullBookingRes.rows.length > 0) {
                const data = fullBookingRes.rows[0];
                const bookingReference = String(data.booking_id).substring(0, 8).toUpperCase();

                await sendBookingConfirmation({
                    userEmail: data.user_email,
                    userName: data.user_name,
                    bookingReference: bookingReference,
                    packageName: data.package_name,
                    travelDate: data.travel_date,
                    totalPrice: data.total_price,
                    numberOfTravelers: data.travelers
                });
                console.log(`[F013] MOCK confirmation sent for booking ${bookingId}`);
            }
        } catch (err) {
            console.error('[F013] Mock notify error:', err);
        }

        res.json({
            success: true,
            message: 'Payment processed successfully (Mock)',
            transactionId,
            status: 'completed'
        });

    } catch (error) {
        console.error('Error processing dummy payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process dummy payment',
            error: error.message
        });
    }
};

/**
 * Handles incoming webhooks from Stripe to update payment statuses asynchronously.
 * Supports intent succession, failure, and refunds.
 * 
 * @async
 * @function webhookHandler
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming receipt of the event.
 */
export const webhookHandler = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('PaymentIntent succeeded:', paymentIntent.id);

            // Update payment status
            await pool.query(
                `UPDATE payments 
         SET status = 'completed', updated_at = NOW() 
         WHERE stripe_payment_intent_id = $1`,
                [paymentIntent.id]
            );
            break;

        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log('PaymentIntent failed:', failedPayment.id);

            // Update payment status
            await pool.query(
                `UPDATE payments 
         SET status = 'failed', updated_at = NOW() 
         WHERE stripe_payment_intent_id = $1`,
                [failedPayment.id]
            );
            break;

        case 'charge.refunded':
            const refund = event.data.object;
            console.log('Charge refunded:', refund.id);
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};
