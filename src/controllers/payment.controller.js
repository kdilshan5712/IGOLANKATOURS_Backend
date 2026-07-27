import stripe from '../config/stripe.js';
import pool from '../config/db.js';
import crypto from 'crypto';

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

/**
 * Generates MD5 hash for PayHere frontend SDK integration
 * @async
 * @function generatePayHereHash
 */
export const generatePayHereHash = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        if (!orderId || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        // .trim() is critical — any trailing newline/space in .env causes PH-0014 hash mismatch
        const merchantId     = (process.env.PAYHERE_MERCHANT_ID || '').trim();
        const merchantSecret = (process.env.PAYHERE_SECRET      || '').trim();

        if (!merchantId || !merchantSecret) {
            console.error('PayHere credentials not configured');
            return res.status(500).json({ success: false, message: 'Payment gateway configuration error' });
        }

        // --- Currency & Amount Conversion ---
        // PayHere's 3990 plan uses LKR. USD prices are converted before charging.
        // PAYHERE_CURRENCY=LKR  PAYHERE_USD_TO_LKR=320  (configurable in env)
        const currency     = (process.env.PAYHERE_CURRENCY   || 'LKR').trim().toUpperCase();
        const usdToLkrRate = parseFloat(process.env.PAYHERE_USD_TO_LKR || '320');

        const usdAmount = parseFloat(amount);
        const chargeAmount = (currency === 'LKR')
            ? (usdAmount * usdToLkrRate)   // convert USD → LKR
            : usdAmount;                    // use as-is for other currencies

        // Format to exactly 2 decimal places — required by PayHere hash formula
        const formattedAmount = chargeAmount.toFixed(2);

        // PayHere order_id max is 20 chars. Strip UUID dashes and truncate.
        const safeOrderId = String(orderId).replace(/-/g, '').substring(0, 20);

        const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();

        // Hash formula: MD5(merchant_id + order_id + amount + currency + MD5(secret).toUpperCase()).toUpperCase()
        const hashString = merchantId + safeOrderId + formattedAmount + currency + hashedSecret;
        const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

        console.log(`[PayHere] Hash: order=${safeOrderId}, USD=${usdAmount}, ${currency}=${formattedAmount}`);

        // Store pending payment. safeOrderId is stored as the bridge so the webhook
        // and verify endpoint can reverse-lookup the real UUID booking_id.
        await pool.query(
            `INSERT INTO payments (booking_id, stripe_payment_intent_id, amount, currency, status, payment_method) 
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [orderId, safeOrderId, usdAmount, 'USD', 'pending', 'payhere']  // store original USD amount
        );

        const isSandbox = process.env.PAYHERE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
        const payhereBaseUrl = isSandbox ? 'https://sandbox.payhere.lk' : 'https://www.payhere.lk';

        // Return all values frontend needs to build the PayHere form POST
        res.json({
            success: true,
            hash,
            merchantId,
            safeOrderId,
            chargeAmount: formattedAmount,   // LKR amount to send to PayHere
            currency,                         // LKR
            usdAmount: usdAmount.toFixed(2),  // Original USD amount (for display)
            checkoutUrl: `${payhereBaseUrl}/pay/checkout`
        });
    } catch (error) {
        console.error('Error generating PayHere hash:', error);
        res.status(500).json({ success: false, message: 'Hash generation failed' });
    }
};

/**
 * Webhook handler for asynchronous PayHere notifications
 * @async
 * @function payhereWebhook
 */
export const payhereWebhook = async (req, res) => {
    try {
        const {
            merchant_id,
            order_id,       // This is our safeOrderId (20-char truncated UUID)
            payhere_amount,
            payhere_currency,
            status_code,
            md5sig,
            payment_id,
            status_message
        } = req.body;

        // .trim() must match hash generation — prevents signature mismatch
        const merchantSecret = (process.env.PAYHERE_SECRET || '').trim();
        
        if (!merchantSecret) {
            return res.status(500).send('Configuration Error');
        }

        const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
        
        const formattedAmount = parseFloat(payhere_amount).toFixed(2);
        const hashString = merchant_id + order_id + formattedAmount + payhere_currency + status_code + hashedSecret;
        const localMd5sig = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

        console.log(`[PayHere Webhook] order_id=${order_id}, status=${status_code}, sig_match=${localMd5sig === md5sig}`);

        // Verify the signature
        if (localMd5sig === md5sig) {

            // IMPORTANT: order_id is the safeOrderId (20-char). We stored it in
            // stripe_payment_intent_id during hash generation, so we reverse-lookup
            // the real UUID booking_id from the payments table.
            const paymentLookup = await pool.query(
                `SELECT booking_id FROM payments WHERE stripe_payment_intent_id = $1 AND payment_method = 'payhere' LIMIT 1`,
                [order_id]
            );
            const realBookingId = paymentLookup.rows[0]?.booking_id;

            if (!realBookingId) {
                console.error(`[PayHere Webhook] Could not find booking for safeOrderId: ${order_id}`);
                return res.status(200).send('OK'); // Return 200 so PayHere doesn't retry endlessly
            }

            if (status_code == '2') { // Payment Success
                console.log(`[PayHere Webhook] Payment success — booking_id: ${realBookingId}`);
                
                // Update payments table with actual PayHere payment_id
                await pool.query(
                    `UPDATE payments SET status = 'completed', stripe_payment_intent_id = $1, updated_at = NOW() 
                     WHERE booking_id = $2`,
                    [payment_id, realBookingId]
                );

                // Update bookings table
                await pool.query(
                    `UPDATE bookings SET status = 'confirmed', payment_status = 'paid' WHERE booking_id = $1`,
                    [realBookingId]
                );

                // Send confirmation email and in-app notification
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
                        [realBookingId]
                    );

                    if (fullBookingRes.rows.length > 0) {
                        const data = fullBookingRes.rows[0];
                        const bookingReference = String(data.booking_id).substring(0, 8).toUpperCase();
                        
                        await NotificationService.create({
                            userId: data.user_id,
                            type: 'booking',
                            title: 'Payment Received via PayHere! 🎉',
                            message: `We've received your payment for ${data.package_name}.`,
                            link: `/dashboard/bookings/${realBookingId}`,
                            sendEmailNotif: false
                        });

                        await sendBookingConfirmation({
                            userEmail: data.user_email,
                            userName: data.user_name,
                            bookingReference: bookingReference,
                            packageName: data.package_name,
                            travelDate: data.travel_date,
                            totalPrice: data.total_price,
                            numberOfTravelers: data.travelers
                        });
                    }
                } catch (emailErr) {
                    console.error('[PayHere Webhook] Email/notification error:', emailErr);
                }

                return res.status(200).send('OK');

            } else if (status_code == '0' || status_code == '-1' || status_code == '-2') {
                // Pending, Canceled, or Failed
                console.log(`[PayHere Webhook] Payment not successful (status ${status_code}) for booking: ${realBookingId}`);
                await pool.query(
                    `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE booking_id = $1`,
                    [realBookingId]
                );
                return res.status(200).send('OK');
            }
        } else {
            console.warn(`[PayHere Webhook] Invalid signature for order: ${order_id}`);
            return res.status(400).send('Invalid signature');
        }
    } catch (error) {
        console.error('PayHere Webhook Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

/**
 * Verifies a PayHere payment using the REST API (App ID + App Secret OAuth)
 * Called from the success page after PayHere redirects the user back.
 * This is a safety net alongside the webhook — ensures booking is confirmed
 * even if the webhook is delayed or fails.
 *
 * @async
 * @function verifyPayHerePayment
 */
export const verifyPayHerePayment = async (req, res) => {
    try {
        const { orderId } = req.params;

        const appId     = (process.env.PAYHERE_AppID     || '').trim();
        const appSecret = (process.env.PAYHERE_AppSecret || '').trim();

        if (!appId || !appSecret) {
            console.error('[PayHere Verify] App ID / App Secret not configured');
            return res.status(500).json({ success: false, message: 'PayHere API credentials not configured' });
        }

        const isSandbox = process.env.PAYHERE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
        const payhereBaseUrl = isSandbox ? 'https://sandbox.payhere.lk' : 'https://www.payhere.lk';

        // Step 1: Get OAuth access token from PayHere
        const tokenRes = await fetch(`${payhereBaseUrl}/merchant/v1/oauth/token`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${appId}:${appSecret}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        const tokenData = await tokenRes.json();
        console.log('[PayHere Verify] Token response status:', tokenRes.status);

        if (!tokenData.access_token) {
            console.error('[PayHere Verify] Failed to get access token:', tokenData);
            return res.status(500).json({ success: false, message: 'Failed to authenticate with PayHere API' });
        }

        // Step 2: Search PayHere for the payment by order_id
        const paymentRes = await fetch(
            `${payhereBaseUrl}/merchant/v1/payment/search?order_id=${encodeURIComponent(orderId)}`,
            {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            }
        );

        const paymentData = await paymentRes.json();
        console.log('[PayHere Verify] Payment search result:', JSON.stringify(paymentData));

        // PayHere returns { status: 1, data: [...] } on success
        if (paymentData.status === 1 && paymentData.data?.length > 0) {
            const latestPayment = paymentData.data[0];

            if (latestPayment.status_code === 2) { // 2 = Paid/Success
                console.log(`[PayHere Verify] Payment confirmed for order: ${orderId}`);

                // Reverse-lookup real UUID booking_id using the safeOrderId bridge
                const paymentLookup = await pool.query(
                    `SELECT booking_id FROM payments 
                     WHERE stripe_payment_intent_id = $1 AND payment_method = 'payhere' 
                     LIMIT 1`,
                    [orderId]
                );
                const realBookingId = paymentLookup.rows[0]?.booking_id;

                if (realBookingId) {
                    // Update payments table with actual PayHere payment ID
                    await pool.query(
                        `UPDATE payments 
                         SET status = 'completed', stripe_payment_intent_id = $1, updated_at = NOW() 
                         WHERE booking_id = $2`,
                        [latestPayment.payment_id, realBookingId]
                    );

                    // Confirm the booking
                    await pool.query(
                        `UPDATE bookings 
                         SET status = 'confirmed', payment_status = 'paid' 
                         WHERE booking_id = $1`,
                        [realBookingId]
                    );

                    console.log(`[PayHere Verify] Booking ${realBookingId} confirmed via API verification`);

                    // Send confirmation email (non-blocking)
                    try {
                        const { NotificationService } = await import('../utils/notificationService.js');
                        const { sendBookingConfirmation } = await import('../utils/emailService.js');

                        const bookingRes = await pool.query(
                            `SELECT b.*, t.full_name as user_name, u.email as user_email, p.name as package_name
                             FROM bookings b
                             JOIN users u ON b.user_id = u.user_id
                             JOIN tourist t ON u.user_id = t.user_id
                             JOIN tour_packages p ON b.package_id = p.package_id
                             WHERE b.booking_id = $1`,
                            [realBookingId]
                        );

                        if (bookingRes.rows.length > 0) {
                            const data = bookingRes.rows[0];
                            await NotificationService.create({
                                userId: data.user_id,
                                type: 'booking',
                                title: 'Payment Confirmed! 🎉',
                                message: `Your payment for ${data.package_name} has been verified and your booking is confirmed.`,
                                link: `/dashboard/bookings/${realBookingId}`,
                                sendEmailNotif: false
                            });
                            await sendBookingConfirmation({
                                userEmail: data.user_email,
                                userName: data.user_name,
                                bookingReference: String(realBookingId).substring(0, 8).toUpperCase(),
                                packageName: data.package_name,
                                travelDate: data.travel_date,
                                totalPrice: data.total_price,
                                numberOfTravelers: data.travelers
                            });
                        }
                    } catch (notifyErr) {
                        console.error('[PayHere Verify] Notification error (non-fatal):', notifyErr);
                    }
                }

                return res.json({
                    success: true,
                    verified: true,
                    booking_id: realBookingId,
                    payment_id: latestPayment.payment_id,
                    amount: latestPayment.payhere_amount,
                    currency: latestPayment.payhere_currency
                });
            }

            // Payment exists but not in success state
            return res.json({
                success: true,
                verified: false,
                status_code: latestPayment.status_code,
                status_message: latestPayment.status_message || 'Payment not completed'
            });
        }

        // No payment record found yet (may still be processing)
        return res.json({ success: true, verified: false, message: 'Payment record not found yet' });

    } catch (error) {
        console.error('[PayHere Verify] Error:', error);
        return res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};
