-- Create seasonal_pricing_rules table
-- Run this on your PostgreSQL database

CREATE TABLE IF NOT EXISTS seasonal_pricing_rules (
    rule_id       SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    start_month   INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    start_day     INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 31),
    end_month     INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
    end_day       INTEGER NOT NULL CHECK (end_day BETWEEN 1 AND 31),
    percentage    NUMERIC(5,2) NOT NULL DEFAULT 0,   -- e.g. 20 = +20%, -10 = -10%
    coast_type    VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (coast_type IN ('south','east','west','north','all')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups during price calculation
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON seasonal_pricing_rules (is_active, coast_type);

-- Seed some default rules as examples
INSERT INTO seasonal_pricing_rules (name, start_month, start_day, end_month, end_day, percentage, coast_type)
VALUES
  ('Peak Season - December/January', 12, 1, 1, 31, 25, 'south'),
  ('High Season - South Coast Summer', 6, 1, 8, 31, 15, 'south'),
  ('Off-Peak Discount', 9, 1, 10, 31, -10, 'all')
ON CONFLICT DO NOTHING;

SELECT 'seasonal_pricing_rules table created successfully' AS status;
