-- Add special rate calculation logic for evento job type
-- Evento jobs should always use 12 hours regardless of actual timesheet hours

-- Create a function to get the billable hours for a job based on its type
-- This will be used in rate calculations
CREATE OR REPLACE FUNCTION get_billable_hours_for_job(
  p_job_id UUID,
  p_actual_hours NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_job_type TEXT;
BEGIN
  -- Get the job type
  SELECT job_type INTO v_job_type
  FROM jobs
  WHERE id = p_job_id;

  -- For evento jobs, always return 12 hours
  IF v_job_type = 'evento' THEN
    RETURN 12.0;
  END IF;

  -- For all other job types, return the actual hours
  RETURN COALESCE(p_actual_hours, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Add a comment to document this function
COMMENT ON FUNCTION get_billable_hours_for_job IS
'Returns the billable hours for a job. For evento jobs, always returns 12 hours regardless of actual timesheet hours. For other job types, returns the actual hours worked.';

-- Create a function to get the appropriate rate for an evento job
-- Evento jobs should always use the 12-hour rate (plus_10_12_eur)
CREATE OR REPLACE FUNCTION get_rate_for_evento_job(
  p_category TEXT,
  p_job_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_job_type TEXT;
  v_rate NUMERIC;
BEGIN
  -- Get the job type
  SELECT job_type INTO v_job_type
  FROM jobs
  WHERE id = p_job_id;

  -- For evento jobs, always return the 12-hour rate
  IF v_job_type = 'evento' THEN
    SELECT plus_10_12_eur INTO v_rate
    FROM rate_cards_2025
    WHERE category = p_category;

    RETURN COALESCE(v_rate, 0);
  END IF;

  -- For other job types, return NULL (indicating to use normal rate calculation)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add a comment to document this function
COMMENT ON FUNCTION get_rate_for_evento_job IS
'Returns the locked 12-hour rate for evento jobs. Returns NULL for other job types, indicating normal rate calculation should be used.';
