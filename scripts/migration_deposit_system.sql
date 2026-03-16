-- Migration to support partial payments and deposit system
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;

COMMENT ON COLUMN bookings.payment_status IS 'Can be pending, partial, or full';
