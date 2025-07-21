-- Create timesheets for existing job assignments
INSERT INTO public.timesheets (
    job_id,
    technician_id,
    date,
    created_by
)
SELECT DISTINCT
    ja.job_id,
    ja.technician_id,
    generate_series(
        DATE(j.start_time),
        DATE(j.end_time),
        '1 day'::interval
    )::date as date,
    ja.assigned_by
FROM job_assignments ja
JOIN jobs j ON j.id = ja.job_id
WHERE NOT EXISTS (
    SELECT 1 FROM timesheets t 
    WHERE t.job_id = ja.job_id 
    AND t.technician_id = ja.technician_id
    AND t.date = generate_series(
        DATE(j.start_time),
        DATE(j.end_time),
        '1 day'::interval
    )::date
);

-- Create function to auto-create timesheets when job assignments are made
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS TRIGGER AS $$
DECLARE
    job_start_date date;
    job_end_date date;
    current_date date;
BEGIN
    -- Get job dates
    SELECT DATE(start_time), DATE(end_time) 
    INTO job_start_date, job_end_date
    FROM jobs 
    WHERE id = NEW.job_id;
    
    -- Create timesheets for each day of the job
    current_date := job_start_date;
    WHILE current_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            current_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;
        
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create timesheets on job assignment
CREATE TRIGGER create_timesheets_on_assignment
    AFTER INSERT ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION create_timesheets_for_assignment();