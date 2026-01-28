-- Migration: Add rejection tracking fields to tour_guide table
-- Date: 2026-01-28
-- Purpose: Store rejection reason and timestamp when a guide application is rejected

-- Add rejection_reason column to store admin's rejection explanation
ALTER TABLE tour_guide
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add rejection_date column to track when rejection occurred
ALTER TABLE tour_guide
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

-- Add rejected_by column to track which admin rejected the guide
ALTER TABLE tour_guide
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(user_id);

-- Add approved_at column to track approval timestamp
ALTER TABLE tour_guide
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Add approved_by column to track which admin approved the guide
ALTER TABLE tour_guide
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(user_id);

-- Add comments for documentation
COMMENT ON COLUMN tour_guide.rejection_reason IS 'Admin explanation for why guide application was rejected';
COMMENT ON COLUMN tour_guide.rejected_at IS 'Timestamp when guide was rejected';
COMMENT ON COLUMN tour_guide.rejected_by IS 'Admin user_id who rejected the guide';
COMMENT ON COLUMN tour_guide.approved_at IS 'Timestamp when guide was approved';
COMMENT ON COLUMN tour_guide.approved_by IS 'Admin user_id who approved the guide';
