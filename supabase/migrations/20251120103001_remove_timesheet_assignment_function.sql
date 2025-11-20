-- Remove all per-day timesheets for a technician/job pair and drop the
-- parent job_assignment row when no coverage remains. This keeps the
-- matrix and downstream payroll views consistent when a dispatcher
-- removes someone from the schedule.
CREATE OR REPLACE FUNCTION public.remove_assignment_with_timesheets(
    p_job_id uuid,
    p_technician_id uuid
)
RETURNS TABLE(deleted_timesheets integer, deleted_assignment boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_timesheets integer := 0;
    v_assignment_deleted boolean := false;
    v_assignment_rows integer := 0;
BEGIN
    IF p_job_id IS NULL OR p_technician_id IS NULL THEN
        RAISE EXCEPTION 'job_id and technician_id are required';
    END IF;

    DELETE FROM timesheets
    WHERE job_id = p_job_id
      AND technician_id = p_technician_id;

    GET DIAGNOSTICS v_deleted_timesheets = ROW_COUNT;

    IF NOT EXISTS (
        SELECT 1
        FROM timesheets
        WHERE job_id = p_job_id
          AND technician_id = p_technician_id
    ) THEN
        DELETE FROM job_assignments
        WHERE job_id = p_job_id
          AND technician_id = p_technician_id;

        GET DIAGNOSTICS v_assignment_rows = ROW_COUNT;
        v_assignment_deleted := v_assignment_rows > 0;
    END IF;

    RETURN QUERY
    SELECT v_deleted_timesheets, v_assignment_deleted;
END;
$$;

COMMENT ON FUNCTION public.remove_assignment_with_timesheets(uuid, uuid)
IS 'Deletes all per-day timesheets for a job/technician pair and removes the parent job_assignment when no coverage remains.';

GRANT EXECUTE ON FUNCTION public.remove_assignment_with_timesheets(uuid, uuid)
  TO authenticated, service_role, anon;
