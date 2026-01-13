-- Migration: Automatically delete timesheets when job_assignment is deleted
-- This prevents orphaned timesheet records from appearing in the UI

-- Create trigger function to delete timesheets when assignment is removed
CREATE OR REPLACE FUNCTION delete_timesheets_on_assignment_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all timesheets for this job+technician combination
  DELETE FROM timesheets
  WHERE job_id = OLD.job_id
    AND technician_id = OLD.technician_id;

  -- Log the cleanup for audit purposes
  RAISE NOTICE 'Deleted timesheets for job_id=%, technician_id=% after job_assignment removal',
    OLD.job_id, OLD.technician_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires BEFORE deletion of job_assignment
-- Using BEFORE to ensure timesheets are deleted before the foreign key context is lost
CREATE TRIGGER trigger_delete_timesheets_on_assignment_removal
  BEFORE DELETE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION delete_timesheets_on_assignment_removal();

-- Add comment for documentation
COMMENT ON FUNCTION delete_timesheets_on_assignment_removal() IS
  'Automatically deletes associated timesheets when a job_assignment is removed to prevent orphaned records';

COMMENT ON TRIGGER trigger_delete_timesheets_on_assignment_removal ON job_assignments IS
  'Cascades deletion to timesheets when job_assignment is deleted';
