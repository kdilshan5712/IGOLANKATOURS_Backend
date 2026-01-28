-- Clear all tour guide accounts while preserving admin accounts
-- Safe cascading delete with transaction rollback on error
-- Execute in Supabase Dashboard → SQL Editor → Run

BEGIN;

-- Create temp table to store guide IDs for reference
CREATE TEMP TABLE guide_ids_to_delete AS
SELECT id FROM users WHERE role = 'guide';

-- Get count of guides to delete
DO $$
DECLARE
  guide_count INT;
BEGIN
  SELECT COUNT(*) INTO guide_count FROM guide_ids_to_delete;
  RAISE NOTICE '📋 Found % guide account(s) to delete', guide_count;
END $$;

-- Step 1: Delete guides table records
DELETE FROM guides
WHERE user_id IN (SELECT id FROM guide_ids_to_delete);

RAISE NOTICE '🗑️ Deleted guides table records';

-- Step 2: Delete guide availability records
DELETE FROM guide_availability
WHERE guide_id IN (SELECT id FROM guide_ids_to_delete);

RAISE NOTICE '🗑️ Deleted guide availability records';

-- Step 3: Delete bookings assigned to guides
DELETE FROM bookings
WHERE guide_id IN (SELECT id FROM guide_ids_to_delete);

RAISE NOTICE '🗑️ Deleted bookings assigned to guides';

-- Step 4: Delete reviews for guides
DELETE FROM reviews
WHERE guide_id IN (SELECT id FROM guide_ids_to_delete);

RAISE NOTICE '🗑️ Deleted reviews for guides';

-- Step 5: Delete guide user accounts
DELETE FROM users
WHERE role = 'guide';

RAISE NOTICE '🗑️ Deleted guide user accounts';

-- Verify deletion
DO $$
DECLARE
  remaining_count INT;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM users WHERE role = 'guide';
  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ All guide accounts successfully removed!';
  ELSE
    RAISE NOTICE '⚠️ Warning: % guide account(s) still exist', remaining_count;
  END IF;
END $$;

RAISE NOTICE '🎉 Guide cleanup complete! Remaining roles: admin, tourist, user';

COMMIT;
