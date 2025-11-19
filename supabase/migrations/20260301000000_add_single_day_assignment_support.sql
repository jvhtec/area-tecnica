-- Add single-day assignment tracking to job_assignments
ALTER TABLE IF EXISTS public.job_assignments
  ADD COLUMN IF NOT EXISTS single_day boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_day_date date;

COMMENT ON COLUMN public.job_assignments.single_day IS 'True when the assignment only covers a single job date';
COMMENT ON COLUMN public.job_assignments.single_day_date IS 'Specific job date covered when single_day is true';

-- Ensure legacy rows have deterministic values
UPDATE public.job_assignments
SET single_day = COALESCE(single_day, false)
WHERE single_day IS NULL;

-- Update timesheet auto-generation to respect the single-day flag
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS TRIGGER AS $$
DECLARE
    job_start_date date;
    job_end_date date;
    current_date date;
BEGIN
    -- When explicitly marked as single-day, only create a timesheet for that date
    IF COALESCE(NEW.single_day, false) = true AND NEW.single_day_date IS NOT NULL THEN
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            NEW.single_day_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;

        RETURN NEW;
    END IF;

    -- Fallback to legacy behaviour (cover full job range)
    SELECT DATE(start_time), DATE(end_time)
    INTO job_start_date, job_end_date
    FROM jobs
    WHERE id = NEW.job_id;

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
$$ LANGUAGE plpgsql SET search_path = '';
