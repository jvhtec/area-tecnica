-- Daily Morning Push Notification Feature
-- Creates event type, schedule configuration table, and cron job for daily morning summaries

-- ============================================================================
-- 1. Add new event type to activity_catalog
-- ============================================================================

INSERT INTO activity_catalog (event_code, label_es, severity, description)
VALUES (
  'daily.morning.summary',
  'Resumen diario matutino',
  'info',
  'Notificación matutina automática con resumen del personal del día'
)
ON CONFLICT (event_code) DO UPDATE
SET
  label_es = EXCLUDED.label_es,
  severity = EXCLUDED.severity,
  description = EXCLUDED.description;

-- ============================================================================
-- 2. Create schedule configuration table
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  schedule_time TIME NOT NULL DEFAULT '08:00:00',
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 1=Monday, 7=Sunday
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_days_of_week CHECK (
    days_of_week <@ ARRAY[1,2,3,4,5,6,7]
  ),
  CONSTRAINT valid_schedule_time CHECK (
    schedule_time >= '06:00:00' AND schedule_time <= '12:00:00'
  )
);

-- Add comment for documentation
COMMENT ON TABLE push_notification_schedules IS 'Configuration for scheduled push notifications';
COMMENT ON COLUMN push_notification_schedules.days_of_week IS '1=Monday, 2=Tuesday, ..., 7=Sunday';
COMMENT ON COLUMN push_notification_schedules.schedule_time IS 'Time in HH:MM:SS format (restricted to 06:00-12:00)';
COMMENT ON COLUMN push_notification_schedules.last_sent_at IS 'Timestamp of last successful send, used to prevent duplicate sends';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_schedules_event_type
ON push_notification_schedules(event_type) WHERE enabled = true;

-- Enable RLS
ALTER TABLE push_notification_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and management can view schedules
CREATE POLICY "Admins and management can view schedules"
ON push_notification_schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
);

-- Policy: Only admins can modify schedules
CREATE POLICY "Only admins can modify schedules"
ON push_notification_schedules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- 3. Insert default schedule for morning summary
-- ============================================================================

INSERT INTO push_notification_schedules (
  event_type,
  enabled,
  schedule_time,
  timezone,
  days_of_week
)
VALUES (
  'daily.morning.summary',
  true,
  '08:00:00',
  'Europe/Madrid',
  ARRAY[1,2,3,4,5] -- Monday to Friday
)
ON CONFLICT (event_type) DO UPDATE
SET
  schedule_time = EXCLUDED.schedule_time,
  timezone = EXCLUDED.timezone,
  days_of_week = EXCLUDED.days_of_week,
  updated_at = NOW();

-- ============================================================================
-- 4. Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_push_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_push_schedule_updated_at ON push_notification_schedules;

CREATE TRIGGER set_push_schedule_updated_at
  BEFORE UPDATE ON push_notification_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_push_schedule_updated_at();

-- ============================================================================
-- 5. Setup pg_cron job for scheduled notifications
-- ============================================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a table to store configuration for the cron job
CREATE TABLE IF NOT EXISTS push_cron_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  supabase_url TEXT NOT NULL,
  service_role_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert placeholder config (will be updated via SQL or admin UI)
INSERT INTO push_cron_config (id, supabase_url, service_role_key)
VALUES (1, 'https://your-project.supabase.co', NULL)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE push_cron_config IS 'Configuration for pg_cron scheduled push notifications. Update supabase_url and service_role_key after migration.';

-- Enable RLS on config table
ALTER TABLE push_cron_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/modify config
CREATE POLICY "Only admins can view cron config"
ON push_cron_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Only admins can modify cron config"
ON push_cron_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create helper function to invoke push edge function
CREATE OR REPLACE FUNCTION invoke_scheduled_push_notification(event_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_row push_cron_config%ROWTYPE;
  response_id BIGINT;
BEGIN
  -- Get configuration
  SELECT * INTO config_row FROM push_cron_config WHERE id = 1;

  IF config_row.supabase_url IS NULL OR config_row.supabase_url = 'https://your-project.supabase.co' THEN
    RAISE WARNING 'Push cron config not set up. Please update push_cron_config table.';
    RETURN;
  END IF;

  -- Invoke edge function via pg_net
  SELECT net.http_post(
    url := config_row.supabase_url || '/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(config_row.service_role_key, current_setting('app.settings.service_role_key', true))
    ),
    body := jsonb_build_object(
      'action', 'check_scheduled',
      'type', event_type
    )::text
  ) INTO response_id;

  RAISE LOG 'Scheduled push notification invoked: %, response_id: %', event_type, response_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke scheduled push notification: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_scheduled_push_notification IS 'Helper function to invoke scheduled push notifications via pg_cron';

-- Remove existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-morning-notifications') THEN
    PERFORM cron.unschedule('check-morning-notifications');
  END IF;
END $$;

-- Create cron job that runs every 15 minutes during morning hours (6 AM - 12 PM) on weekdays
-- The edge function will check if it's the exact scheduled time
SELECT cron.schedule(
  'check-morning-notifications',  -- Job name
  '*/15 6-12 * * 1-5',             -- Every 15 minutes, 6 AM-12 PM, Monday-Friday
  $$SELECT invoke_scheduled_push_notification('daily.morning.summary');$$
);

-- ============================================================================
-- 6. Grant necessary permissions
-- ============================================================================

-- Grant usage on push_notification_schedules to authenticated users
GRANT SELECT ON push_notification_schedules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON push_notification_schedules TO authenticated;

-- ============================================================================
-- Migration complete
-- ============================================================================

COMMENT ON TABLE push_notification_schedules IS 'Completed: Daily morning push notification feature - schedules table, event type, and cron job configured';
