-- Programa push feed delivery dedupe.
-- Unlike the festival push feed, this has no separate opt-in subscription table:
-- recipients are gated by an existing confirmed job_assignments row plus the
-- existing profiles.push_notifications_enabled toggle. Per-row participation is
-- controlled entirely in the hoja_de_ruta.program_schedule_json payload itself
-- (ProgramRow.notify / ProgramRow.departments), read by the edge function.

CREATE TABLE IF NOT EXISTS public.programa_push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_kind text NOT NULL DEFAULT 'programa_row',
  due_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programa_push_delivery_log_user_event_key UNIQUE (user_id, event_key)
);

COMMENT ON TABLE public.programa_push_delivery_log IS
  'Service-role dedupe log for the scheduled hoja de ruta programa push feed (non-festival, non-dryhire jobs).';

CREATE INDEX IF NOT EXISTS idx_programa_push_delivery_log_job_due
  ON public.programa_push_delivery_log (job_id, due_at);

CREATE INDEX IF NOT EXISTS idx_programa_push_delivery_log_event_kind
  ON public.programa_push_delivery_log (event_kind);

CREATE INDEX IF NOT EXISTS idx_programa_push_delivery_log_sent_at
  ON public.programa_push_delivery_log (sent_at);

ALTER TABLE public.programa_push_delivery_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.programa_push_delivery_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.programa_push_delivery_log TO service_role;

DO $cron$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING 'cron schema not available; programa push feed cron was not scheduled';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'programa-push-feed-tick'
  ) THEN
    PERFORM cron.unschedule('programa-push-feed-tick');
  END IF;

  PERFORM cron.schedule(
    'programa-push-feed-tick',
    '* * * * *',
    $$SELECT public.invoke_scheduled_push_notification('programa.feed.tick')$$
  );

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'programa-push-delivery-log-cleanup'
  ) THEN
    PERFORM cron.unschedule('programa-push-delivery-log-cleanup');
  END IF;

  PERFORM cron.schedule(
    'programa-push-delivery-log-cleanup',
    '23 4 * * *',
    $$DELETE FROM public.programa_push_delivery_log WHERE sent_at < now() - interval '14 days'$$
  );
END $cron$;
