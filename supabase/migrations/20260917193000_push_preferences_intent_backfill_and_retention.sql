-- Three corrections to the push notification overhaul:
--
--   1. account_enabled was seeded from profiles.push_notifications_enabled, a
--      column that defaults to false and that no application code ever writes.
--      Seeding from it silently opts out every user who registered a device but
--      never had that flag flipped by hand. Registering a push subscription or a
--      native device token is the actual expression of intent, so derive from it.
--   2. notification_inbox had no index supporting lookups by event_key alone,
--      which finish_push_schedule performs on every scheduled occurrence.
--   3. Nothing ever removed expired inbox rows or historical delivery attempts,
--      so both tables grew without bound.

-- 1. Repair the opt-out -------------------------------------------------------

-- The notification centre that lets a user set account_enabled ships in this same
-- unreleased change, so no stored value can yet represent a deliberate opt-out:
-- every false is an artefact of the seed above. Re-enable unconditionally for any
-- account with a registered target, which is the only durable signal of intent
-- that predates this feature.
UPDATE public.notification_preferences AS np
SET account_enabled = true
WHERE np.account_enabled = false
  AND (
    EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = np.user_id)
    OR EXISTS (SELECT 1 FROM public.push_device_tokens t WHERE t.user_id = np.user_id)
  );

-- Keep future backfills (a restored environment, a re-run) honest by making the
-- intent rule the one used for any account that still has no preference row.
INSERT INTO public.notification_preferences (user_id, account_enabled)
SELECT p.id,
       (
         COALESCE(p.push_notifications_enabled, false)
         OR EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id)
         OR EXISTS (SELECT 1 FROM public.push_device_tokens t WHERE t.user_id = p.id)
       )
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- 2. Support lookups by event_key --------------------------------------------

-- finish_push_schedule matches inbox rows by event_key with no user predicate,
-- so the (user_id, event_key) unique index cannot serve it.
CREATE INDEX IF NOT EXISTS notification_inbox_event_key_idx
  ON public.notification_inbox (event_key);

-- 3. Retention ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_push_history(
  p_inbox_retention interval DEFAULT interval '90 days',
  p_attempt_retention interval DEFAULT interval '30 days',
  p_claim_retention interval DEFAULT interval '30 days'
) RETURNS TABLE (inbox_deleted bigint, attempts_deleted bigint, claims_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inbox bigint := 0;
  v_attempts bigint := 0;
  v_claims bigint := 0;
BEGIN
  -- Read items past their retention window, and unread items whose push TTL
  -- lapsed long ago, are no longer useful history. push_delivery_attempts rows
  -- cascade with their inbox item, so delete those first only where the inbox
  -- row survives but the attempt detail has aged out.
  WITH deleted AS (
    DELETE FROM public.notification_inbox
    WHERE created_at < now() - p_inbox_retention
    RETURNING 1
  )
  SELECT count(*) INTO v_inbox FROM deleted;

  WITH deleted AS (
    DELETE FROM public.push_delivery_attempts
    WHERE attempted_at < now() - p_attempt_retention
    RETURNING 1
  )
  SELECT count(*) INTO v_attempts FROM deleted;

  WITH deleted AS (
    DELETE FROM public.push_schedule_claims
    WHERE status = 'completed'
      AND updated_at < now() - p_claim_retention
    RETURNING 1
  )
  SELECT count(*) INTO v_claims FROM deleted;

  RETURN QUERY SELECT v_inbox, v_attempts, v_claims;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_push_history(interval, interval, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_push_history(interval, interval, interval)
  TO service_role;

COMMENT ON FUNCTION public.purge_push_history(interval, interval, interval) IS
  'Bounded retention sweep for notification_inbox, push_delivery_attempts and completed push_schedule_claims. Invoked by the push Edge Function scheduler tick.';

-- 4. Make the scheduler recovery path reachable --------------------------------

-- finish_push_schedule can leave a claim 'retryable' with next_attempt_at a few
-- minutes out, but handleCheckScheduled only ever reaches claim_push_schedule
-- during the single local minute that matches schedule_time. By the time that
-- gate reopens the occurrence key has rolled to the next day, so the retryable
-- row was never revisited and the recovery machinery was dead code.
--
-- claim_push_schedule_retry lets a tick resume an interrupted occurrence by its
-- own key, independently of the minute gate, with a bounded retry budget so a
-- permanently broken occurrence cannot be re-attempted forever.

ALTER TABLE public.push_schedule_claims
  DROP CONSTRAINT IF EXISTS push_schedule_claims_status_valid,
  ADD CONSTRAINT push_schedule_claims_status_valid
    CHECK (status IN ('processing', 'completed', 'retryable', 'abandoned'));

CREATE INDEX IF NOT EXISTS push_schedule_claims_retryable_idx
  ON public.push_schedule_claims (event_type, next_attempt_at)
  WHERE status = 'retryable';

CREATE OR REPLACE FUNCTION public.claim_push_schedule_retry(
  p_event_type text,
  p_max_attempts integer DEFAULT 5
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_occurrence_key text;
BEGIN
  -- Retire occurrences that have exhausted their retry budget first, so they
  -- stop competing for the lease and stay visible for diagnosis.
  UPDATE public.push_schedule_claims
  SET status = 'abandoned',
      next_attempt_at = NULL,
      updated_at = now()
  WHERE event_type = p_event_type
    AND status = 'retryable'
    AND attempts >= p_max_attempts;

  WITH candidate AS (
    SELECT c.occurrence_key
    FROM public.push_schedule_claims c
    WHERE c.event_type = p_event_type
      AND c.status = 'retryable'
      AND COALESCE(c.next_attempt_at, '-infinity'::timestamptz) <= now()
    ORDER BY c.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.push_schedule_claims AS claim
  SET status = 'processing',
      attempts = claim.attempts + 1,
      lease_expires_at = now() + interval '5 minutes',
      next_attempt_at = NULL,
      updated_at = now()
  FROM candidate
  WHERE claim.event_type = p_event_type
    AND claim.occurrence_key = candidate.occurrence_key
  RETURNING claim.occurrence_key INTO v_occurrence_key;

  RETURN v_occurrence_key;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_schedule_retry(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_schedule_retry(text, integer)
  TO service_role;

COMMENT ON FUNCTION public.claim_push_schedule_retry(text, integer) IS
  'Resumes an interrupted scheduled occurrence by its own key, bypassing the schedule-time gate, with a bounded retry budget after which the claim is abandoned.';

-- 5. New notification category ------------------------------------------------

-- Expenses and payout overrides get their own category so a technician can mute
-- routine job traffic without losing sight of what they are owed. Existing rows
-- are left alone: loadRecipientPreferences treats a missing category key as
-- enabled, so the opt-out remains explicit rather than implied by the backfill.
ALTER TABLE public.notification_preferences
  ALTER COLUMN category_preferences SET DEFAULT
    '{"jobs":true,"staffing":true,"timesheets":true,"tasks":true,"messages":true,"documents":true,"logistics":true,"tours":true,"festival":true,"finance":true,"system":true}'::jsonb;
