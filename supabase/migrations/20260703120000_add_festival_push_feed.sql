-- Festival push feed subscriptions and delivery dedupe.

CREATE TABLE IF NOT EXISTS public.festival_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  stages integer[] NOT NULL DEFAULT '{}'::integer[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_push_subscriptions_user_job_key UNIQUE (user_id, job_id),
  CONSTRAINT festival_push_subscriptions_stages_valid CHECK (
    stages IS NOT NULL
    AND array_position(stages, NULL) IS NULL
    AND stages <@ ARRAY[
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15, 16,
      17, 18, 19, 20, 21, 22, 23, 24,
      25, 26, 27, 28, 29, 30, 31, 32,
      33, 34, 35, 36, 37, 38, 39, 40,
      41, 42, 43, 44, 45, 46, 47, 48,
      49, 50, 51, 52, 53, 54, 55, 56,
      57, 58, 59, 60, 61, 62, 63, 64
    ]::integer[]
  )
);

COMMENT ON TABLE public.festival_push_subscriptions IS
  'Opt-in festival timing push feed. Admin/management may subscribe to selected stages; technician/house_tech subscriptions are constrained to assigned festival shift stages.';
COMMENT ON COLUMN public.festival_push_subscriptions.stages IS
  'Stage numbers included in the feed for this job. Empty arrays are only useful for disabled rows.';

CREATE INDEX IF NOT EXISTS idx_festival_push_subscriptions_job_enabled
  ON public.festival_push_subscriptions (job_id, enabled);

CREATE INDEX IF NOT EXISTS idx_festival_push_subscriptions_user
  ON public.festival_push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.festival_push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_kind text NOT NULL,
  due_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_push_delivery_log_user_event_key UNIQUE (user_id, event_key)
);

COMMENT ON TABLE public.festival_push_delivery_log IS
  'Service-role dedupe log for the scheduled festival push feed.';

CREATE INDEX IF NOT EXISTS idx_festival_push_delivery_log_job_due
  ON public.festival_push_delivery_log (job_id, due_at);

CREATE INDEX IF NOT EXISTS idx_festival_push_delivery_log_event_kind
  ON public.festival_push_delivery_log (event_kind);

CREATE INDEX IF NOT EXISTS idx_festival_push_delivery_log_sent_at
  ON public.festival_push_delivery_log (sent_at);

CREATE OR REPLACE FUNCTION public.get_festival_assigned_stages(
  p_user_id uuid,
  p_job_id uuid
)
RETURNS integer[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(array_agg(DISTINCT fs.stage ORDER BY fs.stage), '{}'::integer[])
  FROM public.festival_shifts fs
  JOIN public.festival_shift_assignments fsa
    ON fsa.shift_id = fs.id
  WHERE fsa.technician_id = p_user_id
    AND fs.job_id = p_job_id
    AND fs.stage IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_festival_push_subscription(
  p_user_id uuid,
  p_job_id uuid,
  p_enabled boolean,
  p_stages integer[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_assigned_stages integer[];
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() OR p_job_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_stages IS NULL OR array_position(p_stages, NULL) IS NOT NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_stages) AS stage_number
    WHERE stage_number < 1 OR stage_number > 64
  ) THEN
    RETURN false;
  END IF;

  -- Let users disable their own row even when assignments or stages changed.
  IF COALESCE(p_enabled, false) = false THEN
    RETURN true;
  END IF;

  IF COALESCE(array_length(p_stages, 1), 0) = 0 THEN
    RETURN false;
  END IF;

  v_role := public.current_user_role();

  IF v_role = ANY (ARRAY['admin'::text, 'management'::text]) THEN
    RETURN true;
  END IF;

  IF v_role = ANY (ARRAY['technician'::text, 'house_tech'::text]) THEN
    v_assigned_stages := public.get_festival_assigned_stages(p_user_id, p_job_id);
    RETURN COALESCE(array_length(v_assigned_stages, 1), 0) > 0
      AND p_stages <@ v_assigned_stages;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_assigned_stages(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_festival_assigned_stages(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_assigned_stages(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.can_manage_festival_push_subscription(uuid, uuid, boolean, integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_festival_push_subscription(uuid, uuid, boolean, integer[]) TO authenticated, service_role;

DROP TRIGGER IF EXISTS set_festival_push_subscriptions_updated_at
  ON public.festival_push_subscriptions;
CREATE TRIGGER set_festival_push_subscriptions_updated_at
  BEFORE UPDATE ON public.festival_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.festival_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_push_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS festival_push_subscriptions_select_own
  ON public.festival_push_subscriptions;
CREATE POLICY festival_push_subscriptions_select_own
  ON public.festival_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS festival_push_subscriptions_insert_own
  ON public.festival_push_subscriptions;
CREATE POLICY festival_push_subscriptions_insert_own
  ON public.festival_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_festival_push_subscription(user_id, job_id, enabled, stages)
  );

DROP POLICY IF EXISTS festival_push_subscriptions_update_own
  ON public.festival_push_subscriptions;
CREATE POLICY festival_push_subscriptions_update_own
  ON public.festival_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    public.can_manage_festival_push_subscription(user_id, job_id, enabled, stages)
  );

DROP POLICY IF EXISTS festival_push_subscriptions_delete_own
  ON public.festival_push_subscriptions;
CREATE POLICY festival_push_subscriptions_delete_own
  ON public.festival_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.festival_push_delivery_log FROM anon, authenticated;
GRANT ALL ON TABLE public.festival_push_delivery_log TO service_role;

REVOKE ALL ON TABLE public.festival_push_subscriptions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.festival_push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.festival_push_subscriptions TO service_role;

DO $cron$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING 'cron schema not available; festival push feed cron was not scheduled';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'festival-push-feed-tick'
  ) THEN
    PERFORM cron.unschedule('festival-push-feed-tick');
  END IF;

  PERFORM cron.schedule(
    'festival-push-feed-tick',
    '* * * * *',
    $$SELECT public.invoke_scheduled_push_notification('festival.feed.tick')$$
  );

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'festival-push-delivery-log-cleanup'
  ) THEN
    PERFORM cron.unschedule('festival-push-delivery-log-cleanup');
  END IF;

  PERFORM cron.schedule(
    'festival-push-delivery-log-cleanup',
    '17 4 * * *',
    $$DELETE FROM public.festival_push_delivery_log WHERE sent_at < now() - interval '14 days'$$
  );
END $cron$;
