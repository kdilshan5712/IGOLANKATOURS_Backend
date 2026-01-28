-- Clear all tourist accounts from database
-- This script deletes all users with role 'tourist' and their related data

-- Start transaction
BEGIN;

-- Count tourists before deletion
DO $$
DECLARE
  tourist_count INT;
BEGIN
  SELECT COUNT(*) INTO tourist_count FROM users WHERE role = 'tourist';
  RAISE NOTICE 'Found % tourist account(s) to delete', tourist_count;
END $$;

-- Store tourist IDs for cascading deletes
CREATE TEMP TABLE temp_tourist_ids AS
SELECT id FROM users WHERE role = 'tourist';

-- Delete related bookings
DELETE FROM bookings WHERE tourist_id IN (SELECT id FROM temp_tourist_ids);
RAISE NOTICE 'Deleted related bookings';

-- Delete related reviews
DELETE FROM reviews WHERE tourist_id IN (SELECT id FROM temp_tourist_ids);
RAISE NOTICE 'Deleted related reviews';

-- Delete related contact messages
DELETE FROM contact_messages WHERE user_id IN (SELECT id FROM temp_tourist_ids);
RAISE NOTICE 'Deleted related contact messages';

-- Delete tourist users
DELETE FROM users WHERE role = 'tourist';
RAISE NOTICE 'Deleted all tourist users';

-- Show final count
DO $$
DECLARE
  remaining_count INT;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM users WHERE role = 'tourist';
  RAISE NOTICE 'Remaining tourist accounts: %', remaining_count;
END $$;

-- Commit transaction
COMMIT;

-- Output success message
SELECT '✅ All tourist accounts cleared successfully!' as status;
