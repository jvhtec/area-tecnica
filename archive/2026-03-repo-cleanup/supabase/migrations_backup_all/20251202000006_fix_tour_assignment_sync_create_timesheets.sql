-- Fix tour assignment sync to also create timesheets for matrix visibility
-- When tour assignments are synced to jobs, the matrix needs timesheet entries to display them

BEGIN;

-- Update sync_existing_tour_assignments_to_new_job() to create timesheets
CREATE OR REPLACE FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_start_date date;
    v_end_date date;
    v_current_date date;
BEGIN
    IF NEW.tour_id IS NOT NULL THEN
        -- Get job date range
        v_start_date := DATE(NEW.start_time);
        v_end_date := DATE(NEW.end_time);

        -- Insert job_assignments for each tour assignment
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

        -- Create timesheets for each day of the job for each tour technician
        -- This makes the assignments visible in the matrix
        v_current_date := v_start_date;
        WHILE v_current_date <= v_end_date LOOP
            INSERT INTO timesheets (
                job_id,
                technician_id,
                date,
                is_schedule_only,
                source,
                created_by
            )
            SELECT
                NEW.id as job_id,
                ta.technician_id,
                v_current_date,
                NEW.job_type IN ('dryhire', 'tourdate') as is_schedule_only,
                'tour' as source,
                ta.assigned_by as created_by
            FROM tour_assignments ta
            WHERE ta.tour_id = NEW.tour_id
            AND ta.technician_id IS NOT NULL
            ON CONFLICT (job_id, technician_id, date) DO NOTHING;

            v_current_date := v_current_date + INTERVAL '1 day';
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_existing_tour_assignments_to_new_job IS
  'Syncs existing tour assignments to new job AND creates timesheets for matrix visibility';

-- Update sync_tour_assignments_to_jobs() to create timesheets when tour assignments are added
CREATE OR REPLACE FUNCTION "public"."sync_tour_assignments_to_jobs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_job record;
    v_start_date date;
    v_end_date date;
    v_current_date date;
BEGIN
    IF NEW.technician_id IS NOT NULL THEN
        -- Insert/update job_assignments for all jobs in this tour
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

        -- Create timesheets for each day of each job in the tour
        -- This makes the assignments visible in the matrix
        FOR v_job IN
            SELECT id, start_time, end_time, job_type
            FROM jobs
            WHERE tour_id = NEW.tour_id
        LOOP
            v_start_date := DATE(v_job.start_time);
            v_end_date := DATE(v_job.end_time);
            v_current_date := v_start_date;

            WHILE v_current_date <= v_end_date LOOP
                INSERT INTO timesheets (
                    job_id,
                    technician_id,
                    date,
                    is_schedule_only,
                    source,
                    created_by
                )
                VALUES (
                    v_job.id,
                    NEW.technician_id,
                    v_current_date,
                    v_job.job_type IN ('dryhire', 'tourdate'),
                    'tour',
                    NEW.assigned_by
                )
                ON CONFLICT (job_id, technician_id, date) DO NOTHING;

                v_current_date := v_current_date + INTERVAL '1 day';
            END LOOP;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_tour_assignments_to_jobs IS
  'Syncs tour assignments to jobs AND creates timesheets for matrix visibility';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ sync_existing_tour_assignments_to_new_job() updated to create timesheets';
    RAISE NOTICE '✓ sync_tour_assignments_to_jobs() updated to create timesheets';
    RAISE NOTICE '';
    RAISE NOTICE 'Tour assignments now create timesheets for matrix visibility';
END $$;

COMMIT;
