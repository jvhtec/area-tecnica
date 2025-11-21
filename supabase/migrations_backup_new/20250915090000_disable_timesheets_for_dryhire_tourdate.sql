-- Disable automatic timesheets for dryhire and tourdate job types
-- 1) Update the function to skip these job types
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    job_start_date date;
    job_end_date date;
    work_date date;
    jtype text;
BEGIN
    -- Get job dates and type
    SELECT DATE(start_time), DATE(end_time), job_type
    INTO job_start_date, job_end_date, jtype
    FROM jobs 
    WHERE id = NEW.job_id;

    -- Skip timesheet creation for dryhire and tourdate jobs
    IF jtype IN ('dryhire', 'tourdate') THEN
        RETURN NEW;
    END IF;
    
    -- Create timesheets for each active day of the job
    work_date := job_start_date;
    WHILE work_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            work_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;
        
        work_date := work_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEW;
END;
$function$;

-- 2) Remove any existing timesheets for dryhire and tourdate jobs
DELETE FROM public.timesheets t
USING public.jobs j
WHERE t.job_id = j.id
  AND j.job_type IN ('dryhire', 'tourdate');

