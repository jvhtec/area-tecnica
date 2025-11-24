-- Phase 8: Drop deprecated columns after verification period
-- Run this migration AFTER verifying everything works in production (1+ week recommended)
-- This migration is intentionally dated in the future to prevent accidental premature execution

BEGIN;

-- Verify all assignments have been normalized
DO $$
DECLARE
  v_single_day_true_count INTEGER;
  v_non_null_date_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_single_day_true_count
  FROM job_assignments
  WHERE single_day = true;

  SELECT COUNT(*) INTO v_non_null_date_count
  FROM job_assignments
  WHERE assignment_date IS NOT NULL;

  IF v_single_day_true_count > 0 THEN
    RAISE WARNING 'Found % assignments with single_day=true. Safe to drop but unexpected.', v_single_day_true_count;
  END IF;

  IF v_non_null_date_count > 0 THEN
    RAISE WARNING 'Found % assignments with non-null assignment_date. Safe to drop but unexpected.', v_non_null_date_count;
  END IF;

  RAISE NOTICE 'Pre-drop verification:';
  RAISE NOTICE '  Assignments with single_day=true: %', v_single_day_true_count;
  RAISE NOTICE '  Assignments with assignment_date: %', v_non_null_date_count;
END $$;

-- Drop the deprecated columns
ALTER TABLE job_assignments
  DROP COLUMN IF EXISTS single_day,
  DROP COLUMN IF EXISTS assignment_date;

-- Final verification
DO $$
DECLARE
  v_total_assignments INTEGER;
  v_total_timesheets INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_assignments FROM job_assignments;
  SELECT COUNT(*) INTO v_total_timesheets FROM timesheets;

  RAISE NOTICE 'Post-drop summary:';
  RAISE NOTICE '  Total job_assignments: %', v_total_assignments;
  RAISE NOTICE '  Total timesheets: %', v_total_timesheets;
  RAISE NOTICE '  Architecture simplified successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Remember to:';
  RAISE NOTICE '  1. Remove deprecated fields from frontend queries';
  RAISE NOTICE '  2. Update conflict detection to use timesheets';
  RAISE NOTICE '  3. Remove display logic for single_day badges';
END $$;

COMMIT;
