-- Check Sound manifests at 09:00, 11:00, 13:00, 15:00, 17:00 and 19:00 Europe/Madrid.
-- The hourly cron trigger plus local-time guard handles CET/CEST transitions.
-- Uses the same secured push_cron_config as the staffing sweeper.
CREATE OR REPLACE FUNCTION public.invoke_sound_manifest_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cfg public.push_cron_config%ROWTYPE;
  request_id bigint;
BEGIN
  IF EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::integer
     NOT IN (9, 11, 13, 15, 17, 19) THEN
    RETURN;
  END IF;
  SELECT * INTO cfg FROM public.push_cron_config WHERE id = 1;
  IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
    RAISE WARNING '[sound_manifest_sync] cron credentials missing; skipping';
    RETURN;
  END IF;
  SELECT net.http_post(
    url := cfg.supabase_url || '/functions/v1/sync-sound-manifests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.service_role_key,
      'apikey', cfg.service_role_key
    ),
    body := '{"triggered_by":"pg_cron"}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO request_id;
  RAISE LOG '[sound_manifest_sync] request_id=%', request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[sound_manifest_sync] invocation failed: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.invoke_sound_manifest_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_sound_manifest_sync() TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING '[sound_manifest_sync] pg_cron unavailable; schedule skipped';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sound-manifest-sync') THEN
    PERFORM cron.unschedule('sound-manifest-sync');
  END IF;
  PERFORM cron.schedule(
    'sound-manifest-sync',
    '0 * * * *',
    'SELECT public.invoke_sound_manifest_sync()'
  );
END;
$$;
