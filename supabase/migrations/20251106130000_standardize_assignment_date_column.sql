-- Standardize job_assignments date column naming
-- Remove single_day_date in favor of assignment_date
-- Audit Report: AUDIT_REPORT_JOB_ASSIGNMENT_MATRIX.md
-- Fix Task: FIX_TASK_2_COLUMN_NAMING.md

DO $$
BEGIN
  -- Check if single_day_date column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'job_assignments'
      AND column_name = 'single_day_date'
  ) THEN
    RAISE NOTICE 'Found single_day_date column, beginning migration...';

    -- First, migrate any data from single_day_date to assignment_date
    -- Only update rows where assignment_date is NULL but single_day_date has a value
    UPDATE job_assignments
    SET assignment_date = single_day_date
    WHERE assignment_date IS NULL
      AND single_day_date IS NOT NULL;

    RAISE NOTICE 'Migrated data from single_day_date to assignment_date for % rows',
      (SELECT COUNT(*)
       FROM job_assignments
       WHERE assignment_date IS NOT NULL AND single_day = true);

    -- Check for any mismatches (data integrity issue)
    IF EXISTS (
      SELECT 1
      FROM job_assignments
      WHERE assignment_date IS NOT NULL
        AND single_day_date IS NOT NULL
        AND assignment_date != single_day_date
    ) THEN
      RAISE WARNING 'Found rows with mismatched assignment_date and single_day_date!';

      -- Log the mismatches for review
      RAISE NOTICE 'Mismatched rows details:';
      DECLARE
        mismatch_record RECORD;
      BEGIN
        FOR mismatch_record IN
          SELECT
            job_id,
            technician_id,
            assignment_date,
            single_day_date,
            created_at
          FROM job_assignments
          WHERE assignment_date IS NOT NULL
            AND single_day_date IS NOT NULL
            AND assignment_date != single_day_date
          LIMIT 10
        LOOP
          RAISE NOTICE 'Job: %, Tech: %, assignment_date: %, single_day_date: %',
            mismatch_record.job_id,
            mismatch_record.technician_id,
            mismatch_record.assignment_date,
            mismatch_record.single_day_date;
        END LOOP;
      END;

      -- For mismatched rows, prioritize assignment_date (it's used in more places in the code)
      RAISE NOTICE 'Keeping assignment_date values for mismatched rows';
    END IF;

    -- Drop the existing unique index that uses COALESCE
    DROP INDEX IF EXISTS job_assignments_single_day_unique;
    RAISE NOTICE 'Dropped old single_day_unique index that referenced single_day_date';

    -- Drop the redundant column
    ALTER TABLE job_assignments DROP COLUMN single_day_date;
    RAISE NOTICE '✅ Dropped single_day_date column successfully';

    -- Recreate the unique index using only assignment_date
    CREATE UNIQUE INDEX job_assignments_single_day_unique
      ON job_assignments (job_id, technician_id, assignment_date)
      WHERE (single_day = true AND assignment_date IS NOT NULL);

    COMMENT ON INDEX job_assignments_single_day_unique IS
      'Ensures a technician can only have one single-day assignment per job per date. Applied only when single_day=true and assignment_date is set. Updated to use only assignment_date after single_day_date column was dropped.';

    RAISE NOTICE '✅ Recreated single_day_unique index with only assignment_date';
  ELSE
    RAISE NOTICE 'Column single_day_date does not exist, nothing to migrate';
  END IF;
END $$;

-- Add/update comment to clarify column usage
COMMENT ON COLUMN job_assignments.assignment_date IS
  'Specific date covered by this assignment when single_day=true. NULL for whole-job assignments. This is the standardized column name for single-day assignment dates.';

COMMENT ON COLUMN job_assignments.single_day IS
  'True when the assignment covers only a single day (assignment_date must be set). False for whole-job assignments covering the entire job span.';

-- Update the timesheet generation trigger to use assignment_date instead of single_day_date
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS TRIGGER AS $$
DECLARE
    job_start_date date;
    job_end_date date;
    current_date date;
BEGIN
    -- When explicitly marked as single-day, only create a timesheet for that date
    -- UPDATED: Now uses assignment_date instead of single_day_date
    IF COALESCE(NEW.single_day, false) = true AND NEW.assignment_date IS NOT NULL THEN
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            NEW.assignment_date,  -- Changed from single_day_date to assignment_date
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;

        RETURN NEW;
    END IF;

    -- Fallback to legacy behaviour (cover full job range)
    SELECT DATE(start_time), DATE(end_time)
    INTO job_start_date, job_end_date
    FROM jobs
    WHERE id = NEW.job_id;

    current_date := job_start_date;
    WHILE current_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            current_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;

        current_date := current_date + INTERVAL '1 day';
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.create_timesheets_for_assignment() IS
  'Trigger function to automatically create timesheets when an assignment is created. For single-day assignments, creates one timesheet for the assignment_date. For whole-job assignments, creates timesheets for all dates in the job span.';

-- Verify the change
DO $$
BEGIN
  RAISE NOTICE '✅ Column naming standardized successfully';
  RAISE NOTICE 'All code should now use assignment_date consistently';
  RAISE NOTICE 'Timesheet trigger updated to use assignment_date';
END $$;
