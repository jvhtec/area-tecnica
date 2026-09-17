CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(9);

-- The repair must leave nobody with a registered push target opted out. This is
-- the regression that shipped when account_enabled was seeded from
-- profiles.push_notifications_enabled, a column nothing in the app ever writes.
SELECT is(
  (
    SELECT count(*)
    FROM public.notification_preferences np
    WHERE np.account_enabled = false
      AND (
        EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = np.user_id)
        OR EXISTS (SELECT 1 FROM public.push_device_tokens t WHERE t.user_id = np.user_id)
      )
  ),
  0::bigint,
  'no account with a registered push target is left opted out'
);

SELECT has_index(
  'public', 'notification_inbox', 'notification_inbox_event_key_idx',
  'finish_push_schedule can look up inbox rows by event_key without a sequential scan'
);

-- Retention
SELECT has_function(
  'public', 'purge_push_history', ARRAY['interval', 'interval', 'interval'],
  'a bounded retention sweep exists for the push history tables'
);

SELECT is(
  (
    SELECT prosecdef FROM pg_proc
    WHERE oid = to_regprocedure('public.purge_push_history(interval,interval,interval)')
  ),
  true,
  'purge_push_history is SECURITY DEFINER'
);

SELECT ok(
  (
    SELECT proconfig @> ARRAY['search_path=""']::text[] FROM pg_proc
    WHERE oid = to_regprocedure('public.purge_push_history(interval,interval,interval)')
  )
  AND (
    SELECT proconfig @> ARRAY['search_path=""']::text[] FROM pg_proc
    WHERE oid = to_regprocedure('public.claim_push_schedule_retry(text,integer)')
  ),
  'the new security-definer RPCs pin an empty search_path'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.purge_push_history(interval,interval,interval)',
    'EXECUTE'
  ),
  'purge_push_history is not callable by ordinary users'
);

-- Recoverable scheduling
SELECT has_function(
  'public', 'claim_push_schedule_retry', ARRAY['text', 'integer'],
  'an interrupted scheduled occurrence can be resumed by its own key'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.claim_push_schedule_retry(text,integer)',
    'EXECUTE'
  ),
  'claim_push_schedule_retry is service-role only'
);

-- A retry budget must exist, otherwise a permanently broken occurrence is
-- re-attempted on every tick forever.
SELECT ok(
  (
    SELECT pg_get_constraintdef(oid) ILIKE '%abandoned%'
    FROM pg_constraint
    WHERE conname = 'push_schedule_claims_status_valid'
      AND conrelid = 'public.push_schedule_claims'::regclass
  ),
  'an exhausted scheduled occurrence can be retired as abandoned'
);

SELECT * FROM finish();
