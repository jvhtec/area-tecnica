-- Migration: Create remove_assignment_with_timesheets RPC
-- This RPC is used by removeTimesheetAssignment.ts service but was missing from migrations

CREATE OR REPLACE FUNCTION remove_assignment_with_timesheets(
  p_job_id UUID,
  p_technician_id UUID
) RETURNS TABLE(
  deleted_timesheets INT,
  deleted_assignment BOOLEAN
) AS $$
DECLARE
  v_deleted_timesheets INT := 0;
  v_assignment_rows INT := 0;
  v_deleted_assignment BOOLEAN := FALSE;
BEGIN
  -- Delete timesheets first
  DELETE FROM timesheets
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  GET DIAGNOSTICS v_deleted_timesheets = ROW_COUNT;

  -- Delete the assignment
  DELETE FROM job_assignments
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  GET DIAGNOSTICS v_assignment_rows = ROW_COUNT;
  v_deleted_assignment := v_assignment_rows > 0;

  -- Return results
  RETURN QUERY SELECT v_deleted_timesheets, v_deleted_assignment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION remove_assignment_with_timesheets TO authenticated;
GRANT EXECUTE ON FUNCTION remove_assignment_with_timesheets TO service_role;

COMMENT ON FUNCTION remove_assignment_with_timesheets IS
  'Removes an assignment and all associated timesheets. Returns count of deleted timesheets and whether assignment was deleted.';
