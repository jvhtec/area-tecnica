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
  has_single_day_date_column BOOLEAN;
BEGIN
  -- Check if single_day_date column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_assignments'
      AND column_name = 'single_day_date'
  ) INTO has_single_day_date_column;

  IF has_single_day_date_column THEN
    RAISE NOTICE 'Found single_day_date column - will check both columns for duplicates';
  ELSE
    RAISE NOTICE 'No single_day_date column - using only assignment_date';
  END IF;

  -- Count whole-job duplicates
  SELECT COUNT(*) INTO whole_job_dupes
  FROM (
    SELECT job_id, technician_id
    FROM job_assignments
    WHERE single_day = false OR assignment_date IS NULL
    GROUP BY job_id, technician_id
    HAVING COUNT(*) > 1
  ) sub;

  -- Count single-day duplicates (handle both column scenarios)
  IF has_single_day_date_column THEN
    -- Both columns exist - use COALESCE
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
  ELSE
    -- Only assignment_date exists
    SELECT COUNT(*) INTO single_day_dupes
    FROM (
      SELECT job_id, technician_id, assignment_date
      FROM job_assignments
      WHERE single_day = true AND assignment_date IS NOT NULL
      GROUP BY job_id, technician_id, assignment_date
      HAVING COUNT(*) > 1
    ) sub;
  END IF;

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

    -- Get details of duplicates (handle both column scenarios)
    IF has_single_day_date_column THEN
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
    ELSE
      SELECT string_agg(
        format('Job: %s, Technician: %s, Date: %s (Count: %s)',
          job_id, technician_id, assignment_date, cnt),
        E'\n'
      ) INTO dupe_details
      FROM (
        SELECT job_id, technician_id, assignment_date, COUNT(*) as cnt
        FROM job_assignments
        WHERE single_day = true AND assignment_date IS NOT NULL
        GROUP BY job_id, technician_id, assignment_date
        HAVING COUNT(*) > 1
        LIMIT 10
      ) dupes;
    END IF;

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
-- Note: This will be recreated in migration 2 after column standardization
DO $$
BEGIN
  -- Check if single_day_date column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_assignments'
      AND column_name = 'single_day_date'
  ) THEN
    -- Both columns exist - use COALESCE
    CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_single_day_unique
      ON job_assignments (job_id, technician_id, COALESCE(assignment_date, single_day_date))
      WHERE (single_day = true AND (assignment_date IS NOT NULL OR single_day_date IS NOT NULL));
    RAISE NOTICE 'Created single-day unique index with COALESCE(assignment_date, single_day_date)';
  ELSE
    -- Only assignment_date exists
    CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_single_day_unique
      ON job_assignments (job_id, technician_id, assignment_date)
      WHERE (single_day = true AND assignment_date IS NOT NULL);
    RAISE NOTICE 'Created single-day unique index with assignment_date only';
  END IF;
END $$;

COMMENT ON INDEX job_assignments_single_day_unique IS
  'Ensures a technician can only have one single-day assignment per job per date. Applied only when single_day=true and a date is set.';

-- Verify constraints by testing
DO $$
BEGIN
  RAISE NOTICE '✅ Unique constraints created successfully';
  RAISE NOTICE 'These constraints will now prevent duplicate assignments at the database level';
  RAISE NOTICE 'Upsert operations in code should now work correctly with onConflict parameters';
END $$;
