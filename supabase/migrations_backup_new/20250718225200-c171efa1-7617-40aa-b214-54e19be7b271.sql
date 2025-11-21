
-- Fix existing tour date jobs that have incorrect job_type and missing tour_id
UPDATE jobs 
SET 
  job_type = 'tourdate',
  tour_id = td.tour_id
FROM tour_dates td
WHERE jobs.tour_date_id = td.id
AND jobs.job_type = 'single'
AND jobs.tour_date_id IS NOT NULL;

-- Backfill missing job_date_types for all existing tour date jobs
INSERT INTO job_date_types (job_id, date, type)
SELECT 
  j.id,
  DATE(j.start_time) as date,
  CASE 
    WHEN td.tour_date_type = 'show' THEN 'show'::job_date_type
    WHEN td.tour_date_type = 'rehearsal' THEN 'rehearsal'::job_date_type 
    WHEN td.tour_date_type = 'travel' THEN 'travel'::job_date_type
    ELSE 'show'::job_date_type
  END as type
FROM jobs j
JOIN tour_dates td ON j.tour_date_id = td.id
WHERE j.job_type = 'tourdate'
AND NOT EXISTS (
  SELECT 1 FROM job_date_types jdt 
  WHERE jdt.job_id = j.id 
  AND jdt.date = DATE(j.start_time)
);

-- Add validation function to ensure tour date jobs are created properly
CREATE OR REPLACE FUNCTION validate_tour_date_job()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this is a job with a tour_date_id, ensure it has the correct job_type and tour_id
  IF NEW.tour_date_id IS NOT NULL THEN
    -- Set job_type to 'tourdate' if not already set
    IF NEW.job_type != 'tourdate' THEN
      NEW.job_type := 'tourdate';
    END IF;
    
    -- Set tour_id from the tour_date if not already set
    IF NEW.tour_id IS NULL THEN
      SELECT tour_id INTO NEW.tour_id 
      FROM tour_dates 
      WHERE id = NEW.tour_date_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically validate tour date jobs
DROP TRIGGER IF EXISTS validate_tour_date_job_trigger ON jobs;
CREATE TRIGGER validate_tour_date_job_trigger
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION validate_tour_date_job();
