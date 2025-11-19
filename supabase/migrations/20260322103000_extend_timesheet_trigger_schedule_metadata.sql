-- Ensure assignment-triggered timesheets always carry scheduling metadata
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
    job_start_date date;
    job_end_date date;
    loop_date date;
    job_type_val text;
    schedule_only boolean;
    creator uuid;
BEGIN
    -- Fetch the job window and classification once
    SELECT DATE(start_time), DATE(end_time), job_type
    INTO job_start_date, job_end_date, job_type_val
    FROM jobs
    WHERE id = NEW.job_id;

    IF job_start_date IS NULL OR job_end_date IS NULL THEN
        RETURN NEW;
    END IF;

    schedule_only := job_type_val IS NOT NULL AND job_type_val IN ('dryhire', 'tourdate');
    creator := NEW.assigned_by;

    -- Single-day assignments only stamp the explicit date
    IF COALESCE(NEW.single_day, false) = true AND NEW.assignment_date IS NOT NULL THEN
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by,
            is_schedule_only,
            source
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            NEW.assignment_date,
            creator,
            schedule_only,
            'assignment'
        )
        ON CONFLICT (job_id, technician_id, date) DO UPDATE
        SET is_schedule_only = EXCLUDED.is_schedule_only,
            source = EXCLUDED.source,
            created_by = COALESCE(EXCLUDED.created_by, timesheets.created_by);

        RETURN NEW;
    END IF;

    -- Whole-job assignments cover every day in the job span
    loop_date := job_start_date;
    WHILE loop_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by,
            is_schedule_only,
            source
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            loop_date,
            creator,
            schedule_only,
            'assignment'
        )
        ON CONFLICT (job_id, technician_id, date) DO UPDATE
        SET is_schedule_only = EXCLUDED.is_schedule_only,
            source = EXCLUDED.source,
            created_by = COALESCE(EXCLUDED.created_by, timesheets.created_by);

        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.create_timesheets_for_assignment() IS
  'Generates per-day timesheets for every assignment, flagging dryhire/tourdate rows as schedule-only so payroll can ignore them.';
