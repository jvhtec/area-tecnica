-- Create a function to safely insert or update job_date_types
-- This function works even before the unique constraint is added by manually checking for duplicates
CREATE OR REPLACE FUNCTION public.upsert_job_date_types(
  p_job_id uuid,
  p_date date,
  p_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
BEGIN
  -- First, check if a record already exists
  SELECT id INTO existing_id
  FROM public.job_date_types
  WHERE job_id = p_job_id AND date = p_date
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Update the existing record
    UPDATE public.job_date_types
    SET type = p_type, updated_at = now()
    WHERE id = existing_id;
  ELSE
    -- Insert a new record
    INSERT INTO public.job_date_types (job_id, date, type)
    VALUES (p_job_id, p_date, p_type);
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upsert_job_date_types(uuid, date, text) TO authenticated, service_role;
