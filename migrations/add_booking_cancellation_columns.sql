-- Add cancellation columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS refund_percentage INTEGER;

-- Add comment
COMMENT ON COLUMN bookings.cancellation_reason IS 'Reason for booking cancellation';
COMMENT ON COLUMN bookings.cancelled_at IS 'Timestamp when booking was cancelled';
COMMENT ON COLUMN bookings.refund_amount IS 'Amount refunded to customer';
COMMENT ON COLUMN bookings.refund_percentage IS 'Percentage of total price refunded';
