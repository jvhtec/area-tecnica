-- Migration: Add push notification for invoicing company changes
-- Sends notification when jobs.invoicing_company field is modified

BEGIN;

-- Add activity catalog entry for the new event
INSERT INTO activity_catalog (code, label, severity, default_visibility, toast_enabled)
VALUES (
  'job.invoicing_company.changed',
  'Invoicing company changed',
  'info',
  'management',
  false
)
ON CONFLICT (code) DO NOTHING;

-- Function to send push notification when invoicing company changes
CREATE OR REPLACE FUNCTION notify_invoicing_company_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_role_key text := current_setting('app.settings.service_role_key', true);
  v_actor_id uuid;
  v_actor_name text;
  v_payload jsonb;
BEGIN
  -- Only proceed if invoicing_company actually changed
  IF NOT (OLD.invoicing_company IS DISTINCT FROM NEW.invoicing_company) THEN
    RETURN NEW;
  END IF;

  -- Validate configuration
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Invoicing company notification trigger requires app.settings.supabase_url and service_role_key to be configured';
    RETURN NEW;
  END IF;

  -- Get current user (who made the change)
  v_actor_id := auth.uid();

  -- Get actor's display name
  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''),
      nickname,
      email,
      'Usuario'
    ) INTO v_actor_name
    FROM profiles
    WHERE id = v_actor_id;
  ELSE
    v_actor_name := 'Sistema';
  END IF;

  -- Build payload for push notification
  v_payload := jsonb_build_object(
    'action', 'broadcast',
    'type', 'job.invoicing_company.changed',
    'job_id', NEW.id,
    'title', NEW.title,
    'actor_id', v_actor_id,
    'actor_name', v_actor_name,
    'changes', jsonb_build_object(
      'invoicing_company', jsonb_build_object(
        'from', OLD.invoicing_company,
        'to', NEW.invoicing_company
      )
    )
  );

  -- Call push notification edge function asynchronously (non-blocking)
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := v_payload
    );
  EXCEPTION
    WHEN undefined_function THEN
      -- pg_net extension not installed
      RAISE WARNING 'pg_net extension not available. Notification not sent for job %: %',
        NEW.id, v_payload::text;
    WHEN SQLSTATE '58000' THEN
      -- System error (network issues, etc.)
      RAISE WARNING 'Failed to send invoicing company notification for job % due to system error: %. Payload: %',
        NEW.id, SQLERRM, v_payload::text;
    WHEN OTHERS THEN
      -- Unexpected error - log but don't fail the transaction
      RAISE WARNING 'Unexpected error sending invoicing company notification for job %: %. Payload: %',
        NEW.id, SQLERRM, v_payload::text;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_invoicing_company_changed() IS
  'Sends push notification to management when job invoicing_company field is modified';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS jobs_notify_invoicing_company_trg ON jobs;

-- Create trigger that fires AFTER UPDATE on invoicing_company
CREATE TRIGGER jobs_notify_invoicing_company_trg
AFTER UPDATE OF invoicing_company ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_invoicing_company_changed();

COMMIT;
