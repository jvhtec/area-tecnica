-- Fix toggle_timesheet_day to skip dryhire jobs entirely
-- Dryhire jobs don't require staff, so no timesheets should be created
-- Tourdate jobs still get timesheets with is_schedule_only=true

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
    v_assignment_source text;
BEGIN
    IF p_job_id IS NULL OR p_technician_id IS NULL OR p_date IS NULL THEN
        RAISE EXCEPTION 'job_id, technician_id, and date are required';
    END IF;

    SELECT job_type INTO v_job_type FROM jobs WHERE id = p_job_id;

    -- Dryhire jobs don't require staff - skip timesheet creation entirely
    IF v_job_type = 'dryhire' THEN
        RETURN;
    END IF;

    -- Tourdate jobs are schedule-only (no hours tracking)
    v_schedule_only := v_job_type = 'tourdate';

    -- Map source to valid assignment_source values (only 'direct', 'tour', 'staffing' allowed)
    v_assignment_source := CASE
        WHEN COALESCE(p_source, 'matrix') IN ('tour') THEN 'tour'
        WHEN COALESCE(p_source, 'matrix') IN ('staffing') THEN 'staffing'
        ELSE 'direct'  -- Default everything else to 'direct' (including 'matrix', 'assignment-dialog', etc)
    END;

    INSERT INTO job_assignments (job_id, technician_id, assignment_source, assigned_by, single_day, assignment_date)
    VALUES (p_job_id, p_technician_id, v_assignment_source, v_actor, true, p_date)
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
IS 'Ensures a parent assignment exists and toggles a per-day timesheet row. Skips dryhire jobs (no staff required). Sets is_schedule_only=true for tourdate jobs.';
