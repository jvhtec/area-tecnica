-- Create function to automatically complete past jobs
CREATE OR REPLACE FUNCTION public.auto_complete_past_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  -- Update jobs that have ended but are not cancelled or already completed
  UPDATE public.jobs
  SET status = 'Completado'::job_status,
      updated_at = now()
  WHERE end_time < now()
    AND status != 'Cancelado'::job_status
    AND status != 'Completado'::job_status;
  
  -- Get the count of updated rows
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$function$;