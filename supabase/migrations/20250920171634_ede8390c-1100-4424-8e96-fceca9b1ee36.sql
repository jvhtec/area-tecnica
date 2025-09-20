-- Drop the existing trigger first
DROP TRIGGER IF EXISTS validate_tour_date_job_trigger ON jobs;

-- Create the updated trigger function that preserves tour connections
CREATE OR REPLACE FUNCTION public.validate_tour_date_job()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only auto-assign tourdate when tour_date_id is first set AND no explicit job_type provided
  IF NEW.tour_date_id IS NOT NULL AND OLD.tour_date_id IS NULL AND NEW.job_type IS NULL THEN
    NEW.job_type := 'tourdate';
  END IF;
  
  -- Always ensure tour_id is set when tour_date_id is present
  IF NEW.tour_date_id IS NOT NULL AND NEW.tour_id IS NULL THEN
    SELECT tour_id INTO NEW.tour_id 
    FROM tour_dates 
    WHERE id = NEW.tour_date_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER validate_tour_date_job_trigger
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION validate_tour_date_job();