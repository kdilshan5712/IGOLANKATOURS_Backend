-- Migration: Add profile photo field to tour_guide table
-- Date: 2026-02-04
-- Purpose: Store guide profile photo URL

-- Add profile_photo column to store URL/path to profile photo
ALTER TABLE tour_guide
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tour_guide.profile_photo IS 'URL or path to guide profile photo stored in Supabase storage';
