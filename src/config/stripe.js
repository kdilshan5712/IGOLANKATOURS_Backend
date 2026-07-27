import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe with secret key or a dummy key to prevent server crash
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_to_prevent_crash_on_startup', {
    apiVersion: '2023-10-16',
});

export default stripe;
