-- Schedule auto-staffing campaign ticks so auto mode can advance waves without
-- a manager manually nudging the campaign.
CREATE OR REPLACE FUNCTION public.invoke_staffing_sweeper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cfg push_cron_config%ROWTYPE;
  request_id bigint;
BEGIN
  SELECT * INTO cfg FROM push_cron_config WHERE id = 1;

  IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
    RAISE WARNING '[staffing_sweeper] push_cron_config not configured - skipping.';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := cfg.supabase_url || '/functions/v1/staffing-sweeper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.service_role_key,
      'apikey', cfg.service_role_key
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron'),
    timeout_milliseconds := 55000
  ) INTO request_id;

  RAISE LOG '[staffing_sweeper] Invoked edge function, net request_id=%', request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[staffing_sweeper] Failed to invoke edge function: %', SQLERRM;
END;
$$;

ALTER FUNCTION public.invoke_staffing_sweeper() OWNER TO postgres;
COMMENT ON FUNCTION public.invoke_staffing_sweeper() IS
  'Invoked by pg_cron every minute to run due auto-staffing campaign ticks.';
GRANT EXECUTE ON FUNCTION public.invoke_staffing_sweeper() TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING '[staffing_sweeper] pg_cron is not installed; skipping schedule setup.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'staffing-sweeper') THEN
    PERFORM cron.unschedule('staffing-sweeper');
  END IF;

  PERFORM cron.schedule(
    'staffing-sweeper',
    '* * * * *',
    'SELECT public.invoke_staffing_sweeper()'
  );
END;
$$;
