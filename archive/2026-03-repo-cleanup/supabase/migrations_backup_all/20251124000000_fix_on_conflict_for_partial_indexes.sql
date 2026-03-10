-- Fix ON CONFLICT clauses to work with partial unique indexes
--
-- Issue: The job_assignments table now uses partial unique indexes instead of
-- a simple unique constraint on (job_id, technician_id). PostgreSQL's ON CONFLICT
-- clause requires matching the exact index definition, including the WHERE clause.
--
-- Affected functions:
-- 1. sync_tour_assignments_to_jobs() - tour assignment sync
-- 2. sync_existing_tour_assignments_to_new_job() - new job tour sync
-- 3. toggle_timesheet_day() - matrix timesheet toggle
--
-- Indexes being referenced:
-- - job_assignments_whole_job_unique: (job_id, technician_id) WHERE (single_day = false OR assignment_date IS NULL)
-- - job_assignments_single_day_unique: (job_id, technician_id, assignment_date) WHERE (single_day = true AND assignment_date IS NOT NULL)

-- 1. Fix sync_tour_assignments_to_jobs() - handles tour assignment -> job assignments sync
CREATE OR REPLACE FUNCTION "public"."sync_tour_assignments_to_jobs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Only process if technician_id is not null (skip external technicians for now)
    IF NEW.technician_id IS NOT NULL THEN
        -- Insert job assignments for all jobs in the tour
        -- Tour assignments are whole-job (single_day = false)
        INSERT INTO job_assignments (
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_by,
            assigned_at,
            assignment_source,
            single_day,
            assignment_date
        )
        SELECT
            j.id as job_id,
            NEW.technician_id,
            CASE WHEN NEW.department = 'sound' THEN NEW.role END as sound_role,
            CASE WHEN NEW.department = 'lights' THEN NEW.role END as lights_role,
            CASE WHEN NEW.department = 'video' THEN NEW.role END as video_role,
            NEW.assigned_by,
            NEW.assigned_at,
            'tour' as assignment_source,
            false as single_day,
            NULL as assignment_date
        FROM jobs j
        WHERE j.tour_id = NEW.tour_id
        ON CONFLICT (job_id, technician_id) WHERE (single_day = false OR assignment_date IS NULL)
        DO UPDATE SET
            sound_role = CASE
                WHEN NEW.department = 'sound' AND EXCLUDED.assignment_source = 'tour'
                THEN NEW.role
                ELSE job_assignments.sound_role
            END,
            lights_role = CASE
                WHEN NEW.department = 'lights' AND EXCLUDED.assignment_source = 'tour'
                THEN NEW.role
                ELSE job_assignments.lights_role
            END,
            video_role = CASE
                WHEN NEW.department = 'video' AND EXCLUDED.assignment_source = 'tour'
                THEN NEW.role
                ELSE job_assignments.video_role
            END,
            assigned_at = CASE
                WHEN EXCLUDED.assignment_source = 'tour'
                THEN NEW.assigned_at
                ELSE job_assignments.assigned_at
            END
        WHERE job_assignments.assignment_source = 'tour';
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Fix sync_existing_tour_assignments_to_new_job() - handles new job added to tour
CREATE OR REPLACE FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Only process if the job is part of a tour
    IF NEW.tour_id IS NOT NULL THEN
        -- Insert assignments from tour to this new job (only for non-null technician_id)
        -- Tour assignments are whole-job (single_day = false)
        INSERT INTO job_assignments (
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_by,
            assigned_at,
            assignment_source,
            single_day,
            assignment_date
        )
        SELECT
            NEW.id as job_id,
            ta.technician_id,
            CASE WHEN ta.department = 'sound' THEN ta.role END as sound_role,
            CASE WHEN ta.department = 'lights' THEN ta.role END as lights_role,
            CASE WHEN ta.department = 'video' THEN ta.role END as video_role,
            ta.assigned_by,
            ta.assigned_at,
            'tour' as assignment_source,
            false as single_day,
            NULL as assignment_date
        FROM tour_assignments ta
        WHERE ta.tour_id = NEW.tour_id
        AND ta.technician_id IS NOT NULL
        ON CONFLICT (job_id, technician_id) WHERE (single_day = false OR assignment_date IS NULL)
        DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Fix toggle_timesheet_day() - handles single-day assignments from matrix
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
    v_schedule_only := v_job_type IS NOT NULL AND v_job_type IN ('dryhire', 'tourdate');

    -- Map source to valid assignment_source values (only 'direct', 'tour', 'staffing' allowed)
    v_assignment_source := CASE
        WHEN COALESCE(p_source, 'matrix') IN ('tour') THEN 'tour'
        WHEN COALESCE(p_source, 'matrix') IN ('staffing') THEN 'staffing'
        ELSE 'direct'  -- Default everything else to 'direct' (including 'matrix', 'assignment-dialog', etc)
    END;

    -- Insert single-day assignment, using the correct partial unique index
    INSERT INTO job_assignments (job_id, technician_id, assignment_source, assigned_by, single_day, assignment_date)
    VALUES (p_job_id, p_technician_id, v_assignment_source, v_actor, true, p_date)
    ON CONFLICT (job_id, technician_id, assignment_date) WHERE (single_day = true AND assignment_date IS NOT NULL)
    DO NOTHING;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.toggle_timesheet_day(uuid, uuid, date, boolean, text)
  TO authenticated, service_role, anon;

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Fixed ON CONFLICT clauses to work with partial unique indexes';
    RAISE NOTICE 'Functions updated: sync_tour_assignments_to_jobs, sync_existing_tour_assignments_to_new_job, toggle_timesheet_day';
END $$;
