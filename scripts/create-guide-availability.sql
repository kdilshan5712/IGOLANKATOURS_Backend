-- Create guide_availability table for managing guide availability schedules

CREATE TABLE IF NOT EXISTS guide_availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES tour_guide(guide_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('available', 'unavailable')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one availability record per guide per date
  UNIQUE(guide_id, date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_guide_availability_guide_date 
ON guide_availability(guide_id, date);

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_guide_availability_date 
ON guide_availability(date);

-- Add comment
COMMENT ON TABLE guide_availability IS 'Stores guide availability schedule - which dates guides are available or unavailable';
COMMENT ON COLUMN guide_availability.status IS 'Values: available or unavailable';
COMMENT ON COLUMN guide_availability.date IS 'The date for which availability is being set';
