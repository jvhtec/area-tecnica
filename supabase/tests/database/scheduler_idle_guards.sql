-- Per-minute scheduler ticks return before calling out (pg_net + edge function)
-- when the handler would have nothing to do (20261016150000).
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
BEGIN;
SELECT plan(5);

-- Without a push_cron_config row, a tick that passes its guard logs
-- 'Push cron config not set up'; a guarded tick logs nothing.
DELETE FROM public.push_cron_config;
DELETE FROM public.push_cron_execution_log;

SELECT public.invoke_scheduled_push_notification('festival.feed.tick');
SELECT is(
  (SELECT count(*) FROM public.push_cron_execution_log WHERE event_type = 'festival.feed.tick'),
  0::bigint,
  'festival feed tick is skipped when no subscribed festival has dates around today'
);

SELECT public.invoke_scheduled_push_notification('programa.feed.tick');
SELECT is(
  (SELECT count(*) FROM public.push_cron_execution_log WHERE event_type = 'programa.feed.tick'),
  0::bigint,
  'programa feed tick is skipped when no job around today has an approved programa'
);

SELECT public.invoke_scheduled_push_notification('daily.morning.summary');
SELECT is(
  (SELECT count(*) FROM public.push_cron_execution_log WHERE event_type = 'daily.morning.summary'),
  1::bigint,
  'unguarded event types still reach the call-out path'
);

SELECT ok(
  pg_get_functiondef('public.invoke_staffing_sweeper()'::regprocedure) ~* 'staffing_campaigns[\s\S]*next_run_at <= now\(\)[\s\S]*net\.http_post',
  'the staffing sweeper checks for a due campaign before calling out'
);

SELECT ok(
  pg_get_functiondef('public.invoke_staffing_sweeper()'::regprocedure) ~* 'next_run_at <= now\(\)\s+and sc\.run_lock is null[\s\S]*net\.http_post',
  'like get_campaigns_to_tick(), the sweeper guard ignores campaigns another tick has locked'
);

SELECT * FROM finish();
ROLLBACK;
