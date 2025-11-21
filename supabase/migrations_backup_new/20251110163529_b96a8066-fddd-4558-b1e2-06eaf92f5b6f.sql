-- Create execution log table for debugging
CREATE TABLE IF NOT EXISTS public.push_cron_execution_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  request_id BIGINT,
  success BOOLEAN DEFAULT false,
  error_message TEXT
);

-- Enable RLS on the log table
ALTER TABLE public.push_cron_execution_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view logs
CREATE POLICY "Admins can view push cron logs"
ON public.push_cron_execution_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Drop and recreate the function with correct pg_net syntax
DROP FUNCTION IF EXISTS public.invoke_scheduled_push_notification(text);

CREATE OR REPLACE FUNCTION public.invoke_scheduled_push_notification(event_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  cfg push_cron_config%ROWTYPE;
  request_id bigint;
  log_id bigint;
BEGIN
  -- Get config
  SELECT * INTO cfg FROM push_cron_config WHERE id = 1;
  
  IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
    INSERT INTO push_cron_execution_log (event_type, success, error_message)
    VALUES (event_type, false, 'Push cron config not set up')
    RETURNING id INTO log_id;
    
    RAISE WARNING 'Push cron config not set up (log_id=%)', log_id;
    RETURN;
  END IF;
  
  -- Make HTTP request using pg_net with correct v0.14+ syntax
  BEGIN
    SELECT net.http_post(
      url := cfg.supabase_url || '/functions/v1/push',
      body := jsonb_build_object(
        'action', 'check_scheduled',
        'type', event_type
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.service_role_key
      )
    ) INTO request_id;
    
    -- Log success
    INSERT INTO push_cron_execution_log (event_type, request_id, success)
    VALUES (event_type, request_id, true)
    RETURNING id INTO log_id;
    
    RAISE LOG 'Scheduled push request created: event_type=%, request_id=%, log_id=%', 
      event_type, request_id, log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log failure
    INSERT INTO push_cron_execution_log (event_type, success, error_message)
    VALUES (event_type, false, SQLERRM)
    RETURNING id INTO log_id;
    
    RAISE WARNING 'Failed to invoke scheduled push for % (log_id=%): %', 
      event_type, log_id, SQLERRM;
  END;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION public.invoke_scheduled_push_notification IS 
  'Invokes the push edge function for scheduled notifications. Uses pg_net v0.14+ API with named parameters.';

COMMENT ON TABLE public.push_cron_execution_log IS
  'Tracks execution of scheduled push notification cron jobs for debugging';
