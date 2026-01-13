-- Add production_role column to job_assignments table
-- This allows production department jobs to assign role-specific positions

BEGIN;

-- Add production_role column to job_assignments
ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS production_role TEXT;

-- Add comment to document the column
COMMENT ON COLUMN job_assignments.production_role IS
  'Role assigned to technician for production department jobs (e.g., PROD-RESP-R, PROD-AYUD-T, PROD-COND-T)';

-- Verify the column was added
DO $$
DECLARE
  v_column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'job_assignments'
      AND column_name = 'production_role'
  ) INTO v_column_exists;

  IF v_column_exists THEN
    RAISE NOTICE '✓ production_role column added successfully';
  ELSE
    RAISE EXCEPTION 'Failed to add production_role column';
  END IF;
END $$;

COMMIT;
