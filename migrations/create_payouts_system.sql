-- Migration to create the payout system for tour guides

-- 1. Add bank information to tour_guide table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_guide' AND column_name = 'bank_name') THEN
    ALTER TABLE tour_guide ADD COLUMN bank_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_guide' AND column_name = 'account_no') THEN
    ALTER TABLE tour_guide ADD COLUMN account_no VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_guide' AND column_name = 'account_name') THEN
    ALTER TABLE tour_guide ADD COLUMN account_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_guide' AND column_name = 'branch_name') THEN
    ALTER TABLE tour_guide ADD COLUMN branch_name VARCHAR(100);
  END IF;
END $$;

-- 2. Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
  payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES tour_guide(guide_id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, paid, rejected
  admin_notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_payout_requests_guide_id ON payout_requests(guide_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_requested_at ON payout_requests(requested_at DESC);

COMMENT ON TABLE payout_requests IS 'Tracks guide requests for their earned commission payouts';
