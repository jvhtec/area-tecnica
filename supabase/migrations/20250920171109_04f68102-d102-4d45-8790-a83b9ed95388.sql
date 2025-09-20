-- Drop the existing trigger first
DROP TRIGGER IF EXISTS validate_tour_date_job_trigger ON jobs;

-- Create the updated trigger function with less aggressive logic
CREATE OR REPLACE FUNCTION public.validate_tour_date_job()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- If tour_date_id is being set to non-null for the first time
  IF NEW.tour_date_id IS NOT NULL AND (OLD.tour_date_id IS NULL OR OLD.tour_date_id IS DISTINCT FROM NEW.tour_date_id) THEN
    -- Auto-assign tourdate type only if job_type hasn't been explicitly changed
    IF NEW.job_type = COALESCE(OLD.job_type, 'single') OR NEW.job_type IS NULL THEN
      NEW.job_type := 'tourdate';
    END IF;
    
    -- Set tour_id from tour_date if not already set
    IF NEW.tour_id IS NULL THEN
      SELECT tour_id INTO NEW.tour_id 
      FROM tour_dates 
      WHERE id = NEW.tour_date_id;
    END IF;
  END IF;
  
  -- If user is explicitly changing job_type away from 'tourdate', disconnect from tour
  IF NEW.job_type != 'tourdate' AND NEW.tour_date_id IS NOT NULL THEN
    NEW.tour_date_id := NULL;
    -- Only clear tour_id if this was the only connection
    IF NOT EXISTS (
      SELECT 1 FROM jobs 
      WHERE tour_id = NEW.tour_id 
      AND id != NEW.id 
      AND job_type = 'tourdate'
    ) THEN
      NEW.tour_id := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER validate_tour_date_job_trigger
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION validate_tour_date_job();