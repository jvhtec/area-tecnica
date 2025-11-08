-- Automatic Timesheet Reminders - Cron Job Setup
-- Creates a scheduled job to send timesheet reminders 24 hours after job completion

-- ============================================================================
-- 1. Enable required extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. Create helper function to invoke the auto-send-timesheet-reminders edge function
-- ============================================================================

CREATE OR REPLACE FUNCTION invoke_auto_timesheet_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  response_id BIGINT;
BEGIN
  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);

  -- If not set, try to get from push_cron_config table (if it exists)
  IF supabase_url IS NULL OR supabase_url = '' THEN
    BEGIN
      SELECT push_cron_config.supabase_url INTO supabase_url
      FROM push_cron_config
      WHERE id = 1;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE WARNING 'Supabase URL not configured. Set app.settings.supabase_url or use push_cron_config table.';
        RETURN;
    END;
  END IF;

  -- Get service role key
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF service_role_key IS NULL OR service_role_key = '' THEN
    BEGIN
      SELECT push_cron_config.service_role_key INTO service_role_key
      FROM push_cron_config
      WHERE id = 1;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE WARNING 'Service role key not configured.';
        RETURN;
    END;
  END IF;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Auto timesheet reminders: Configuration incomplete. Skipping execution.';
    RETURN;
  END IF;

  -- Invoke edge function via pg_net
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/auto-send-timesheet-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::text
  ) INTO response_id;

  RAISE LOG 'Auto timesheet reminders invoked, response_id: %', response_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke auto timesheet reminders: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_auto_timesheet_reminders IS
  'Helper function to invoke automatic timesheet reminders edge function via pg_cron. ' ||
  'Sends reminders to technicians 24 hours after job completion if timesheets not submitted.';

-- ============================================================================
-- 3. Schedule the cron job
-- ============================================================================

-- Remove existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-send-timesheet-reminders') THEN
    PERFORM cron.unschedule('auto-send-timesheet-reminders');
    RAISE NOTICE 'Removed existing auto-send-timesheet-reminders cron job';
  END IF;
END $$;

-- Create cron job that runs every hour
-- This checks for jobs that ended 24 hours ago (with a 1-hour window)
SELECT cron.schedule(
  'auto-send-timesheet-reminders',  -- Job name
  '0 * * * *',                       -- Every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
  $$SELECT invoke_auto_timesheet_reminders();$$
);

-- ============================================================================
-- 4. Grant permissions
-- ============================================================================

-- Grant execute permission on the function to postgres role
GRANT EXECUTE ON FUNCTION invoke_auto_timesheet_reminders() TO postgres;

-- ============================================================================
-- Migration complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Automatic timesheet reminders cron job configured';
  RAISE NOTICE 'Schedule: Every hour at minute 0';
  RAISE NOTICE 'Edge function: auto-send-timesheet-reminders';
  RAISE NOTICE 'Target: Jobs that ended 24 hours ago with incomplete timesheets';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Important: Configure Supabase URL and service role key:';
  RAISE NOTICE '   Option 1: Set app.settings.supabase_url and app.settings.service_role_key';
  RAISE NOTICE '   Option 2: Update push_cron_config table (if exists)';
END $$;
