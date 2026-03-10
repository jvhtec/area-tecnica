-- Backfill timesheets for existing tour assignments
-- This makes existing tour assignments visible in the matrix

BEGIN;

DO $$
DECLARE
    v_assignment record;
    v_job record;
    v_start_date date;
    v_end_date date;
    v_current_date date;
    v_count integer := 0;
BEGIN
    RAISE NOTICE 'Backfilling timesheets for existing tour assignments...';

    -- Find all tour-sourced job assignments that don't have complete timesheet coverage
    FOR v_assignment IN
        SELECT DISTINCT
            ja.job_id,
            ja.technician_id,
            j.start_time,
            j.end_time,
            j.job_type
        FROM job_assignments ja
        INNER JOIN jobs j ON j.id = ja.job_id
        WHERE ja.assignment_source = 'tour'
        AND ja.technician_id IS NOT NULL
    LOOP
        v_start_date := DATE(v_assignment.start_time);
        v_end_date := DATE(v_assignment.end_time);
        v_current_date := v_start_date;

        -- Create timesheets for each day of the job
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
                v_assignment.job_id,
                v_assignment.technician_id,
                v_current_date,
                v_assignment.job_type IN ('dryhire', 'tourdate'),
                'tour',
                NULL  -- Don't know who created it historically
            )
            ON CONFLICT (job_id, technician_id, date) DO NOTHING;

            v_current_date := v_current_date + INTERVAL '1 day';
        END LOOP;

        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE 'Backfilled timesheets for % tour assignments', v_count;
END $$;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ Tour assignment timesheets backfilled';
    RAISE NOTICE '';
    RAISE NOTICE 'Existing tour assignments are now visible in the matrix';
END $$;

COMMIT;
