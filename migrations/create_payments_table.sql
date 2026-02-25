-- Create payments table for tracking all payment transactions
CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50) DEFAULT 'card',
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  refund_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Add payment_status and refund_amount columns to bookings table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'refund_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN refund_amount DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Create index on payment_status
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

COMMENT ON TABLE payments IS 'Stores all payment transactions processed through Stripe';
COMMENT ON COLUMN payments.stripe_payment_intent_id IS 'Stripe Payment Intent ID for tracking';
COMMENT ON COLUMN payments.status IS 'Payment status: pending, completed, failed, refunded';
COMMENT ON COLUMN payments.refund_amount IS 'Amount refunded if applicable';
