-- Migration: Add Guide Assignment Columns to Bookings Table
-- This adds columns to track guide assignment for each booking

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_guide_id UUID REFERENCES tour_guide(guide_id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guide_assigned_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guide_assigned_by UUID REFERENCES users(user_id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_guide ON bookings(assigned_guide_id);
