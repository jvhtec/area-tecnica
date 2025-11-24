-- HOTFIX: Ensure job_assignments_unique index exists
-- This index is required for ON CONFLICT clauses to work

BEGIN;

-- Drop if exists (in case it's partially created)
DROP INDEX IF EXISTS job_assignments_unique;

-- Verify no duplicates exist
DO $$
DECLARE
  v_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT job_id, technician_id, COUNT(*) as cnt
    FROM job_assignments
    GROUP BY job_id, technician_id
    HAVING COUNT(*) > 1
  ) dupes;
  
  IF v_duplicates > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % duplicate job+tech pairs exist', v_duplicates;
  END IF;
  
  RAISE NOTICE 'No duplicates found, safe to create unique index';
END $$;

-- Create the unique index
CREATE UNIQUE INDEX job_assignments_unique
  ON job_assignments (job_id, technician_id);

RAISE NOTICE '✅ job_assignments_unique index created successfully';

COMMIT;
