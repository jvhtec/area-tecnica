-- Toggle a single per-day timesheet row from the matrix while ensuring
-- the parent job_assignment exists for status/invite workflows.
CREATE OR REPLACE FUNCTION public.toggle_timesheet_day(
    p_job_id uuid,
    p_technician_id uuid,
    p_date date,
    p_present boolean,
    p_source text DEFAULT 'matrix'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_type text;
    v_schedule_only boolean := false;
    v_actor uuid := auth.uid();
BEGIN
    IF p_job_id IS NULL OR p_technician_id IS NULL OR p_date IS NULL THEN
        RAISE EXCEPTION 'job_id, technician_id, and date are required';
    END IF;

    SELECT job_type INTO v_job_type FROM jobs WHERE id = p_job_id;
    v_schedule_only := v_job_type IS NOT NULL AND v_job_type IN ('dryhire', 'tourdate');

    INSERT INTO job_assignments (job_id, technician_id, assignment_source, assigned_by, single_day, assignment_date)
    VALUES (p_job_id, p_technician_id, COALESCE(p_source, 'matrix'), v_actor, true, p_date)
    ON CONFLICT (job_id, technician_id) DO NOTHING;

    IF p_present THEN
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by,
            is_schedule_only,
            source
        ) VALUES (
            p_job_id,
            p_technician_id,
            p_date,
            v_actor,
            v_schedule_only,
            COALESCE(p_source, 'matrix')
        )
        ON CONFLICT (job_id, technician_id, date) DO UPDATE
        SET is_schedule_only = EXCLUDED.is_schedule_only,
            source = EXCLUDED.source,
            created_by = COALESCE(EXCLUDED.created_by, timesheets.created_by);
    ELSE
        DELETE FROM timesheets
        WHERE job_id = p_job_id
          AND technician_id = p_technician_id
          AND date = p_date;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.toggle_timesheet_day(uuid, uuid, date, boolean, text)
IS 'Ensures a parent assignment exists and toggles a per-day timesheet row used by the staffing matrix.';
GRANT EXECUTE ON FUNCTION public.toggle_timesheet_day(uuid, uuid, date, boolean, text)
  TO authenticated, service_role, anon;
