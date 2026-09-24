CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(1);

SELECT ok(
  (
    SELECT pg_get_functiondef(oid) ILIKE '%notification_inbox%'
      AND pg_get_functiondef(oid) ILIKE '%provider_status%'
      AND pg_get_functiondef(oid) ILIKE '%pending%'
      AND pg_get_functiondef(oid) ILIKE '%failed%'
    FROM pg_proc
    WHERE oid = to_regprocedure('public.finish_push_schedule(text,text,boolean,text)')
  ),
  'schedule completion is gated by durable per-recipient inbox outcomes'
);

SELECT * FROM finish();
