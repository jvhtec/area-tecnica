-- Migration: Fix cascade delete trigger to use RAISE EXCEPTION
-- Addresses senior engineer review finding: silent failures possible

CREATE OR REPLACE FUNCTION delete_timesheets_on_assignment_removal()
RETURNS TRIGGER AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Delete all timesheets for this job+technician combination
  DELETE FROM timesheets
  WHERE job_id = OLD.job_id
    AND technician_id = OLD.technician_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Log the cleanup (changed from NOTICE to INFO for proper logging)
  RAISE INFO 'Cascade delete: Removed % timesheets for job_id=%, technician_id=% after job_assignment removal',
    v_deleted_count, OLD.job_id, OLD.technician_id;

  -- Note: We don't raise an exception if no timesheets were deleted
  -- because it's valid for an assignment to have no timesheets yet
  -- (e.g., newly created assignment not yet scheduled in matrix)

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- If deletion fails for any reason (FK violations, permissions, etc), abort the assignment deletion
    RAISE EXCEPTION 'Failed to delete timesheets during assignment removal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_timesheets_on_assignment_removal() IS
  'Automatically deletes associated timesheets when a job_assignment is removed. Raises exception on failure to prevent orphaned data.';
