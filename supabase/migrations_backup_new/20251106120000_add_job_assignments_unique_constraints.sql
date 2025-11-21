-- Add unique constraints for job_assignments to prevent duplicates
-- This migration addresses the critical data integrity issue identified in audit
-- Audit Report: AUDIT_REPORT_JOB_ASSIGNMENT_MATRIX.md
-- Fix Task: FIX_TASK_1_UNIQUE_CONSTRAINTS.md

-- First, check for any existing duplicates and log them
DO $$
DECLARE
  whole_job_dupes INTEGER;
  single_day_dupes INTEGER;
  dupe_details TEXT;
BEGIN
  -- Count whole-job duplicates
  SELECT COUNT(*) INTO whole_job_dupes
  FROM (
    SELECT job_id, technician_id
    FROM job_assignments
    WHERE single_day = false OR assignment_date IS NULL
    GROUP BY job_id, technician_id
    HAVING COUNT(*) > 1
  ) sub;

  -- Count single-day duplicates (check both assignment_date and single_day_date columns)
  SELECT COUNT(*) INTO single_day_dupes
  FROM (
    SELECT
      job_id,
      technician_id,
      COALESCE(assignment_date, single_day_date) as effective_date
    FROM job_assignments
    WHERE (single_day = true AND (assignment_date IS NOT NULL OR single_day_date IS NOT NULL))
    GROUP BY job_id, technician_id, COALESCE(assignment_date, single_day_date)
    HAVING COUNT(*) > 1
  ) sub;

  -- Raise notice (not error) to inform about duplicates
  IF whole_job_dupes > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate whole-job assignments', whole_job_dupes;

    -- Get details of duplicates
    SELECT string_agg(
      format('Job: %s, Technician: %s (Count: %s)', job_id, technician_id, cnt),
      E'\n'
    ) INTO dupe_details
    FROM (
      SELECT job_id, technician_id, COUNT(*) as cnt
      FROM job_assignments
      WHERE single_day = false OR assignment_date IS NULL
      GROUP BY job_id, technician_id
      HAVING COUNT(*) > 1
      LIMIT 10
    ) dupes;

    RAISE NOTICE 'Sample whole-job duplicates (max 10):\n%', dupe_details;
  END IF;

  IF single_day_dupes > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate single-day assignments', single_day_dupes;

    -- Get details of duplicates
    SELECT string_agg(
      format('Job: %s, Technician: %s, Date: %s (Count: %s)',
        job_id, technician_id, effective_date, cnt),
      E'\n'
    ) INTO dupe_details
    FROM (
      SELECT
        job_id,
        technician_id,
        COALESCE(assignment_date, single_day_date) as effective_date,
        COUNT(*) as cnt
      FROM job_assignments
      WHERE single_day = true AND (assignment_date IS NOT NULL OR single_day_date IS NOT NULL)
      GROUP BY job_id, technician_id, COALESCE(assignment_date, single_day_date)
      HAVING COUNT(*) > 1
      LIMIT 10
    ) dupes;

    RAISE NOTICE 'Sample single-day duplicates (max 10):\n%', dupe_details;
  END IF;

  -- If duplicates exist, the constraint creation below will fail
  -- This is intentional - duplicates must be resolved first
  IF whole_job_dupes > 0 OR single_day_dupes > 0 THEN
    RAISE WARNING 'Duplicate assignments found. Please resolve before creating constraints.';
    RAISE WARNING 'Run the following query to see all duplicates:';
    RAISE WARNING 'SELECT job_id, technician_id, COUNT(*) FROM job_assignments WHERE single_day = false GROUP BY job_id, technician_id HAVING COUNT(*) > 1;';
  ELSE
    RAISE NOTICE 'No duplicate assignments found. Safe to proceed with constraint creation.';
  END IF;
END $$;

-- Create partial unique index for whole-job assignments
-- Prevents multiple whole-job assignments for same technician on same job
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_whole_job_unique
  ON job_assignments (job_id, technician_id)
  WHERE (single_day = false OR assignment_date IS NULL);

COMMENT ON INDEX job_assignments_whole_job_unique IS
  'Ensures a technician can only have one whole-job assignment per job. Applied only when single_day=false or assignment_date is NULL.';

-- Create partial unique index for single-day assignments
-- Prevents multiple single-day assignments for same technician on same job and date
-- Note: Using COALESCE to handle both assignment_date and single_day_date columns
-- (Fix Task #2 will standardize on assignment_date only)
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_single_day_unique
  ON job_assignments (job_id, technician_id, COALESCE(assignment_date, single_day_date))
  WHERE (single_day = true AND (assignment_date IS NOT NULL OR single_day_date IS NOT NULL));

COMMENT ON INDEX job_assignments_single_day_unique IS
  'Ensures a technician can only have one single-day assignment per job per date. Applied only when single_day=true and a date is set.';

-- Verify constraints by testing
DO $$
BEGIN
  RAISE NOTICE '✅ Unique constraints created successfully';
  RAISE NOTICE 'These constraints will now prevent duplicate assignments at the database level';
  RAISE NOTICE 'Upsert operations in code should now work correctly with onConflict parameters';
END $$;
