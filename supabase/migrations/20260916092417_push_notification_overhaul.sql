-- Push notification overhaul: device health, recipient preferences, durable inbox,
-- delivery observability, and recoverable scheduler claims.

-- Keep one preference row per account before making user_id the conflict target
-- used by the application. Preserve the most recently updated row.
DELETE FROM public.notification_preferences older
USING public.notification_preferences newer
WHERE older.user_id = newer.user_id
  AND older.user_id IS NOT NULL
  AND (
    older.updated_at < newer.updated_at
    OR (older.updated_at = newer.updated_at AND older.id < newer.id)
  );

DELETE FROM public.notification_preferences WHERE user_id IS NULL;

ALTER TABLE public.notification_preferences
  ALTER COLUMN user_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS account_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category_preferences jsonb NOT NULL DEFAULT
    '{"jobs":true,"staffing":true,"timesheets":true,"tasks":true,"messages":true,"documents":true,"logistics":true,"tours":true,"festival":true,"system":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start time without time zone NOT NULL DEFAULT '22:00:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end time without time zone NOT NULL DEFAULT '07:00:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS urgent_bypass boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS muted_entities jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_key,
  ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id),
  DROP CONSTRAINT IF EXISTS notification_preferences_category_preferences_object,
  ADD CONSTRAINT notification_preferences_category_preferences_object
    CHECK (jsonb_typeof(category_preferences) = 'object'),
  DROP CONSTRAINT IF EXISTS notification_preferences_muted_entities_array,
  ADD CONSTRAINT notification_preferences_muted_entities_array
    CHECK (jsonb_typeof(muted_entities) = 'array');

INSERT INTO public.notification_preferences (user_id, account_enabled)
SELECT p.id, COALESCE(p.push_notifications_enabled, false)
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET account_enabled = COALESCE(EXCLUDED.account_enabled, public.notification_preferences.account_enabled);

DROP POLICY IF EXISTS "Users can manage own notification preferences"
  ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
  ON public.notification_preferences
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.notification_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS disabled_at timestamp with time zone;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_sync_status_valid,
  ADD CONSTRAINT push_subscriptions_sync_status_valid
    CHECK (sync_status IN ('active', 'stale', 'failing', 'disabled')),
  DROP CONSTRAINT IF EXISTS push_subscriptions_failure_count_nonnegative,
  ADD CONSTRAINT push_subscriptions_failure_count_nonnegative CHECK (failure_count >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_idx
  ON public.push_subscriptions (user_id, device_id)
  WHERE device_id IS NOT NULL;

DROP POLICY IF EXISTS "p_push_subscriptions_public_delete_4377f9"
  ON public.push_subscriptions;
DROP POLICY IF EXISTS "p_push_subscriptions_public_insert_3cdfdf"
  ON public.push_subscriptions;
DROP POLICY IF EXISTS "p_push_subscriptions_public_select_db683f"
  ON public.push_subscriptions;
DROP POLICY IF EXISTS "p_push_subscriptions_public_update_8dae35"
  ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

ALTER TABLE public.push_device_tokens
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS disabled_at timestamp with time zone;

ALTER TABLE public.push_device_tokens
  DROP CONSTRAINT IF EXISTS push_device_tokens_sync_status_valid,
  ADD CONSTRAINT push_device_tokens_sync_status_valid
    CHECK (sync_status IN ('active', 'stale', 'failing', 'disabled')),
  DROP CONSTRAINT IF EXISTS push_device_tokens_failure_count_nonnegative,
  ADD CONSTRAINT push_device_tokens_failure_count_nonnegative CHECK (failure_count >= 0);

DROP POLICY IF EXISTS "Users can manage their native push tokens"
  ON public.push_device_tokens;
CREATE POLICY push_device_tokens_select_own
  ON public.push_device_tokens FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY push_device_tokens_insert_own
  ON public.push_device_tokens FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY push_device_tokens_update_own
  ON public.push_device_tokens FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY push_device_tokens_delete_own
  ON public.push_device_tokens FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.push_device_tokens FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_device_tokens TO authenticated;
GRANT ALL ON TABLE public.push_device_tokens TO service_role;

CREATE TABLE public.notification_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_type text NOT NULL,
  category text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  body text,
  url text NOT NULL DEFAULT '/',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  provider_status text NOT NULL DEFAULT 'pending',
  accepted_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_inbox_user_event_key UNIQUE (user_id, event_key),
  CONSTRAINT notification_inbox_category_nonempty CHECK (length(btrim(category)) > 0),
  CONSTRAINT notification_inbox_urgency_valid CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT notification_inbox_provider_status_valid
    CHECK (provider_status IN ('pending', 'accepted', 'partial', 'failed', 'skipped')),
  CONSTRAINT notification_inbox_counts_nonnegative CHECK (accepted_count >= 0 AND failed_count >= 0)
);

CREATE INDEX notification_inbox_user_created_idx
  ON public.notification_inbox (user_id, created_at DESC);
CREATE INDEX notification_inbox_user_unread_idx
  ON public.notification_inbox (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TRIGGER update_notification_inbox_updated_at
  BEFORE UPDATE ON public.notification_inbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notification_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_inbox_select_own
  ON public.notification_inbox
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY notification_inbox_update_own
  ON public.notification_inbox
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.notification_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notification_inbox TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notification_inbox TO authenticated;
GRANT ALL ON TABLE public.notification_inbox TO service_role;

CREATE TABLE public.push_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL REFERENCES public.notification_inbox(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  target_fingerprint text NOT NULL,
  status text NOT NULL,
  status_code integer,
  attempt_count integer NOT NULL DEFAULT 1,
  last_error_code text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_delivery_attempts_target_key UNIQUE (inbox_id, target_fingerprint),
  CONSTRAINT push_delivery_attempts_channel_valid CHECK (channel IN ('webpush', 'apns')),
  CONSTRAINT push_delivery_attempts_status_valid CHECK (status IN ('accepted', 'failed', 'skipped')),
  CONSTRAINT push_delivery_attempts_count_positive CHECK (attempt_count > 0)
);

CREATE INDEX push_delivery_attempts_user_attempted_idx
  ON public.push_delivery_attempts (user_id, attempted_at DESC);
CREATE INDEX push_delivery_attempts_status_attempted_idx
  ON public.push_delivery_attempts (status, attempted_at DESC);

CREATE TRIGGER update_push_delivery_attempts_updated_at
  BEFORE UPDATE ON public.push_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.push_delivery_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_delivery_attempts_select_own
  ON public.push_delivery_attempts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.push_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.push_delivery_attempts TO authenticated;
GRANT ALL ON TABLE public.push_delivery_attempts TO service_role;

CREATE TABLE public.push_schedule_claims (
  event_type text NOT NULL,
  occurrence_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  attempts integer NOT NULL DEFAULT 1,
  lease_expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  next_attempt_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (event_type, occurrence_key),
  CONSTRAINT push_schedule_claims_status_valid CHECK (status IN ('processing', 'completed', 'retryable')),
  CONSTRAINT push_schedule_claims_attempts_positive CHECK (attempts > 0)
);

ALTER TABLE public.push_schedule_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_schedule_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_schedule_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_push_schedule(
  p_event_type text,
  p_occurrence_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed boolean := false;
BEGIN
  INSERT INTO public.push_schedule_claims (
    event_type,
    occurrence_key,
    status,
    attempts,
    lease_expires_at,
    updated_at
  ) VALUES (
    p_event_type,
    p_occurrence_key,
    'processing',
    1,
    now() + interval '5 minutes',
    now()
  )
  ON CONFLICT (event_type, occurrence_key) DO UPDATE
  SET status = 'processing',
      attempts = public.push_schedule_claims.attempts + 1,
      lease_expires_at = now() + interval '5 minutes',
      next_attempt_at = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE (
    public.push_schedule_claims.status = 'retryable'
    AND COALESCE(public.push_schedule_claims.next_attempt_at, '-infinity'::timestamptz) <= now()
  ) OR (
    public.push_schedule_claims.status = 'processing'
    AND public.push_schedule_claims.lease_expires_at <= now()
  )
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_push_schedule(
  p_event_type text,
  p_occurrence_key text,
  p_success boolean,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.push_schedule_claims
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'retryable' END,
      lease_expires_at = now(),
      next_attempt_at = CASE WHEN p_success THEN NULL ELSE now() + interval '2 minutes' END,
      last_error = CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_error, 'delivery_failed'), 500) END,
      updated_at = now()
  WHERE event_type = p_event_type
    AND occurrence_key = p_occurrence_key;
$$;

CREATE OR REPLACE FUNCTION public.record_push_target_health(
  p_channel text,
  p_target text,
  p_success boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_channel = 'webpush' THEN
    UPDATE public.push_subscriptions
    SET sync_status = CASE
          WHEN p_success THEN 'active'
          WHEN failure_count + 1 >= 3 THEN 'failing'
          ELSE 'stale'
        END,
        failure_count = CASE WHEN p_success THEN 0 ELSE failure_count + 1 END,
        last_verified_at = CASE WHEN p_success THEN now() ELSE last_verified_at END,
        last_failure_at = CASE WHEN p_success THEN NULL ELSE now() END,
        last_seen_at = CASE WHEN p_success THEN now() ELSE last_seen_at END
    WHERE endpoint = p_target;
  ELSIF p_channel = 'apns' THEN
    UPDATE public.push_device_tokens
    SET sync_status = CASE
          WHEN p_success THEN 'active'
          WHEN failure_count + 1 >= 3 THEN 'failing'
          ELSE 'stale'
        END,
        failure_count = CASE WHEN p_success THEN 0 ELSE failure_count + 1 END,
        last_verified_at = CASE WHEN p_success THEN now() ELSE last_verified_at END,
        last_failure_at = CASE WHEN p_success THEN NULL ELSE now() END,
        updated_at = now()
    WHERE device_token = p_target;
  ELSE
    RAISE EXCEPTION 'unsupported push channel';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_schedule(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_push_schedule(text, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_push_target_health(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_schedule(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_push_schedule(text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_push_target_health(text, text, boolean) TO service_role;

COMMENT ON TABLE public.notification_inbox IS
  'Recipient-owned notification history. Opening an item only updates read_at; it never completes the underlying work item.';
COMMENT ON TABLE public.push_delivery_attempts IS
  'Provider acceptance attempts keyed by inbox item and opaque target fingerprint.';
COMMENT ON TABLE public.push_schedule_claims IS
  'Atomic, leased claims for scheduled push occurrences with bounded recovery after failures or worker crashes.';
