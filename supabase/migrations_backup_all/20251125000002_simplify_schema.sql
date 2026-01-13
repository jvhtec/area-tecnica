-- Phase 3: Simplify schema - drop partial indexes and create simple unique constraint
-- This migration removes the complex partial unique indexes and creates a simple one

BEGIN;

-- Drop the partial unique indexes
DROP INDEX IF EXISTS job_assignments_whole_job_unique;
DROP INDEX IF EXISTS job_assignments_single_day_unique;

-- Create simple unique index on (job_id, technician_id)
-- This is the original simple architecture: one assignment per job+technician
CREATE UNIQUE INDEX job_assignments_unique
  ON job_assignments (job_id, technician_id);

COMMENT ON INDEX job_assignments_unique IS
  'Ensures each technician can only have one assignment per job. Timesheets track which specific days.';

-- Drop the check constraint if it exists
ALTER TABLE job_assignments
  DROP CONSTRAINT IF EXISTS job_assignments_single_day_check;

-- Mark columns as deprecated (we'll drop them in a future migration after verification)
COMMENT ON COLUMN job_assignments.single_day IS
  'DEPRECATED: Will be removed in future migration. Use timesheets table to determine which days a technician works.';

COMMENT ON COLUMN job_assignments.assignment_date IS
  'DEPRECATED: Will be removed in future migration. Use timesheets table to determine which days a technician works.';

-- Verify the new constraint works
DO $$
DECLARE
  v_total_assignments INTEGER;
  v_unique_pairs INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_assignments FROM job_assignments;

  SELECT COUNT(DISTINCT (job_id, technician_id)) INTO v_unique_pairs
  FROM job_assignments;

  RAISE NOTICE 'Schema simplification complete:';
  RAISE NOTICE '  Total assignments: %', v_total_assignments;
  RAISE NOTICE '  Unique job+tech pairs: %', v_unique_pairs;

  IF v_total_assignments != v_unique_pairs THEN
    RAISE EXCEPTION 'Constraint violation: assignments (%) != unique pairs (%)',
      v_total_assignments, v_unique_pairs;
  END IF;

  RAISE NOTICE '✓ Simple unique constraint is now active';
  RAISE NOTICE '✓ Partial indexes removed';
  RAISE NOTICE '✓ single_day and assignment_date marked as deprecated';
END $$;

COMMIT;
