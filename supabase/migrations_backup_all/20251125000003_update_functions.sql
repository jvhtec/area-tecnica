-- Phase 4: Update database functions to use simplified architecture
-- This migration updates all functions that interact with job_assignments

BEGIN;

-- 1. Update toggle_timesheet_day() - simplified for new architecture
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

    -- Map source to valid assignment_source values
    v_assignment_source := CASE
        WHEN COALESCE(p_source, 'matrix') IN ('tour') THEN 'tour'
        WHEN COALESCE(p_source, 'matrix') IN ('staffing') THEN 'staffing'
        ELSE 'direct'
    END;

    -- Ensure parent assignment exists (SIMPLIFIED - no more single_day/assignment_date!)
    INSERT INTO job_assignments (
        job_id,
        technician_id,
        assignment_source,
        assigned_by,
        assigned_at
    )
    VALUES (
        p_job_id,
        p_technician_id,
        v_assignment_source,
        v_actor,
        NOW()
    )
    ON CONFLICT (job_id, technician_id) DO NOTHING;

    IF p_present THEN
        -- Add timesheet for this day
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
        -- Remove timesheet for this day
        DELETE FROM timesheets
        WHERE job_id = p_job_id
          AND technician_id = p_technician_id
          AND date = p_date;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.toggle_timesheet_day(uuid, uuid, date, boolean, text) IS
  'SIMPLIFIED: Ensures a parent assignment exists (one per job+tech) and toggles a per-day timesheet row used by the staffing matrix.';

-- 2. Update sync_tour_assignments_to_jobs() - simplified for new architecture
CREATE OR REPLACE FUNCTION "public"."sync_tour_assignments_to_jobs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
AS $$
BEGIN
    IF NEW.technician_id IS NOT NULL THEN
        -- SIMPLIFIED: Insert one assignment per job+tech (no single_day/assignment_date)
        INSERT INTO job_assignments (
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_by,
            assigned_at,
            assignment_source
        )
        SELECT
            j.id as job_id,
            NEW.technician_id,
            CASE WHEN NEW.department = 'sound' THEN NEW.role END as sound_role,
            CASE WHEN NEW.department = 'lights' THEN NEW.role END as lights_role,
            CASE WHEN NEW.department = 'video' THEN NEW.role END as video_role,
            NEW.assigned_by,
            NEW.assigned_at,
            'tour' as assignment_source
        FROM jobs j
        WHERE j.tour_id = NEW.tour_id
        ON CONFLICT (job_id, technician_id)
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

COMMENT ON FUNCTION public.sync_tour_assignments_to_jobs IS
  'SIMPLIFIED: Syncs tour assignments to individual jobs using simple unique constraint.';

-- 3. Update sync_existing_tour_assignments_to_new_job() - simplified for new architecture
CREATE OR REPLACE FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
AS $$
BEGIN
    IF NEW.tour_id IS NOT NULL THEN
        -- SIMPLIFIED: Insert one assignment per job+tech (no single_day/assignment_date)
        INSERT INTO job_assignments (
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_by,
            assigned_at,
            assignment_source
        )
        SELECT
            NEW.id as job_id,
            ta.technician_id,
            CASE WHEN ta.department = 'sound' THEN ta.role END as sound_role,
            CASE WHEN ta.department = 'lights' THEN ta.role END as lights_role,
            CASE WHEN ta.department = 'video' THEN ta.role END as video_role,
            ta.assigned_by,
            ta.assigned_at,
            'tour' as assignment_source
        FROM tour_assignments ta
        WHERE ta.tour_id = NEW.tour_id
        AND ta.technician_id IS NOT NULL
        ON CONFLICT (job_id, technician_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_existing_tour_assignments_to_new_job IS
  'SIMPLIFIED: Syncs existing tour assignments to new job using simple unique constraint.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.toggle_timesheet_day(uuid, uuid, date, boolean, text)
  TO authenticated, service_role, anon;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ toggle_timesheet_day() updated and simplified';
    RAISE NOTICE '✓ sync_tour_assignments_to_jobs() updated and simplified';
    RAISE NOTICE '✓ sync_existing_tour_assignments_to_new_job() updated and simplified';
    RAISE NOTICE '';
    RAISE NOTICE 'All database functions now use simplified architecture:';
    RAISE NOTICE '  - job_assignments: one record per job+technician';
    RAISE NOTICE '  - timesheets: track which specific days';
END $$;

COMMIT;
