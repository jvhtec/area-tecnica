-- Phase 2: Prepare for simplification by ensuring all data integrity
-- This migration ensures all single-day assignments have corresponding timesheets

BEGIN;

-- Step 1: Ensure timesheets exist for all single-day assignments
INSERT INTO timesheets (job_id, technician_id, date, is_schedule_only, source, created_by)
SELECT DISTINCT
  ja.job_id,
  ja.technician_id,
  ja.assignment_date::date,
  COALESCE(j.job_type IN ('dryhire', 'tourdate'), false) as is_schedule_only,
  'migration' as source,
  ja.assigned_by
FROM job_assignments ja
JOIN jobs j ON j.id = ja.job_id
WHERE ja.single_day = true
  AND ja.assignment_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM timesheets ts
    WHERE ts.job_id = ja.job_id
      AND ts.technician_id = ja.technician_id
      AND ts.date = ja.assignment_date::date
  )
ON CONFLICT (job_id, technician_id, date) DO NOTHING;

-- Step 2: Log the preparation
DO $$
DECLARE
  v_single_day_count INTEGER;
  v_whole_job_count INTEGER;
  v_duplicates_count INTEGER;
BEGIN
  -- Count current assignment types
  SELECT COUNT(*) INTO v_single_day_count
  FROM job_assignments
  WHERE single_day = true;

  SELECT COUNT(*) INTO v_whole_job_count
  FROM job_assignments
  WHERE single_day = false OR single_day IS NULL;

  -- Count duplicates that will be consolidated
  SELECT COUNT(*) INTO v_duplicates_count
  FROM (
    SELECT job_id, technician_id
    FROM job_assignments
    GROUP BY job_id, technician_id
    HAVING COUNT(*) > 1
  ) dups;

  RAISE NOTICE 'Pre-simplification analysis:';
  RAISE NOTICE '  Single-day assignments: %', v_single_day_count;
  RAISE NOTICE '  Whole-job assignments: %', v_whole_job_count;
  RAISE NOTICE '  Job+Tech pairs with multiple assignments: %', v_duplicates_count;
END $$;

COMMIT;
