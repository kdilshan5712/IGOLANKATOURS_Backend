-- Migration: Add profile photo field to tourist and admin tables
-- Date: 2026-03-07
-- Purpose: Store profile photo URL for all users

-- Add profile_photo to tourist
ALTER TABLE tourist ADD COLUMN IF NOT EXISTS profile_photo TEXT;
COMMENT ON COLUMN tourist.profile_photo IS 'URL or path to tourist profile photo';

-- Add profile_photo to admin
ALTER TABLE admin ADD COLUMN IF NOT EXISTS profile_photo TEXT;
COMMENT ON COLUMN admin.profile_photo IS 'URL or path to admin profile photo';
