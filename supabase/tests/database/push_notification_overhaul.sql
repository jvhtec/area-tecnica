CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(24);

SELECT has_table('public', 'notification_inbox', 'notification inbox exists');
SELECT has_table('public', 'push_delivery_attempts', 'push delivery attempts exist');
SELECT has_table('public', 'push_schedule_claims', 'push schedule claims exist');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_inbox'::regclass),
  'notification inbox has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.push_delivery_attempts'::regclass),
  'delivery attempts have RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.push_schedule_claims'::regclass),
  'schedule claims have RLS enabled'
);

SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_preferences'
      AND policyname IN ('notification_preferences_select_own', 'notification_preferences_insert_own', 'notification_preferences_update_own')) = 3,
  'notification preferences have scoped select, insert, and update policies'
);
SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_inbox'
      AND policyname IN ('notification_inbox_select_own', 'notification_inbox_update_own')) = 2,
  'notification inbox has own-row read and update policies'
);
SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions'
      AND policyname LIKE 'push_subscriptions_%_own') = 4
  AND (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_device_tokens'
      AND policyname LIKE 'push_device_tokens_%_own') = 4,
  'web and native push registrations have own-row CRUD policies'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.notification_preferences', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.notification_inbox', 'SELECT'),
  'anonymous callers cannot read preferences or inbox items'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.push_subscriptions', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.push_subscriptions', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.push_device_tokens', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.push_device_tokens', 'INSERT'),
  'anonymous callers have no push registration privileges'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.notification_inbox', 'SELECT')
  AND has_column_privilege('authenticated', 'public.notification_inbox', 'read_at', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.notification_inbox', 'title', 'UPDATE'),
  'authenticated users can read inbox items and update only read_at'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.push_delivery_attempts', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.push_delivery_attempts', 'INSERT'),
  'authenticated users can inspect but cannot create delivery attempts'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.push_schedule_claims', 'SELECT')
  AND has_table_privilege('service_role', 'public.push_schedule_claims', 'SELECT'),
  'schedule claims are service-role only'
);

SELECT ok(to_regprocedure('public.claim_push_schedule(text,text)') IS NOT NULL, 'schedule claim RPC exists');
SELECT ok(to_regprocedure('public.finish_push_schedule(text,text,boolean,text)') IS NOT NULL, 'schedule finish RPC exists');
SELECT ok(to_regprocedure('public.record_push_target_health(text,text,boolean)') IS NOT NULL, 'target health RPC exists');

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_push_schedule(text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.finish_push_schedule(text,text,boolean,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.record_push_target_health(text,text,boolean)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.claim_push_schedule(text,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.finish_push_schedule(text,text,boolean,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.record_push_target_health(text,text,boolean)', 'EXECUTE'),
  'scheduler and target-health RPCs are service-role only'
);
SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=""']::text[] FROM pg_proc WHERE oid = to_regprocedure('public.claim_push_schedule(text,text)'))
  AND (SELECT proconfig @> ARRAY['search_path=""']::text[] FROM pg_proc WHERE oid = to_regprocedure('public.finish_push_schedule(text,text,boolean,text)'))
  AND (SELECT proconfig @> ARRAY['search_path=""']::text[] FROM pg_proc WHERE oid = to_regprocedure('public.record_push_target_health(text,text,boolean)')),
  'security-definer RPCs pin an empty search_path'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notification_inbox'::regclass
      AND conname = 'notification_inbox_user_event_key'),
  'inbox deduplicates each event per recipient'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'notification_inbox'
      AND indexname = 'notification_inbox_user_unread_idx'),
  'inbox has a recipient unread index'
);
SELECT ok(
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
      AND column_name IN ('device_id', 'device_name', 'enabled', 'sync_status', 'last_verified_at', 'failure_count', 'last_failure_at', 'disabled_at')) = 8
  AND (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'push_device_tokens'
      AND column_name IN ('enabled', 'sync_status', 'last_verified_at', 'failure_count', 'last_failure_at', 'disabled_at')) = 6,
  'web and native push registrations expose device health fields'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc
    WHERE oid = to_regprocedure('public.record_push_target_health(text,text,boolean)')
      AND pg_get_functiondef(oid) ILIKE '%failure_count + 1%'
      AND pg_get_functiondef(oid) ILIKE '%push_subscriptions%'
      AND pg_get_functiondef(oid) ILIKE '%push_device_tokens%'),
  'target health records successes and increments provider failures'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc
    WHERE oid = to_regprocedure('public.finish_push_schedule(text,text,boolean,text)')
      AND pg_get_functiondef(oid) ILIKE '%notification_inbox%'
      AND pg_get_functiondef(oid) ILIKE '%provider_status%'
      AND pg_get_functiondef(oid) ILIKE '%pending%'
      AND pg_get_functiondef(oid) ILIKE '%failed%'),
  'schedule completion remains retryable while recipient delivery is incomplete'
);

SELECT * FROM finish();
