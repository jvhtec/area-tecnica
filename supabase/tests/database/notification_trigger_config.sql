CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(7);

-- The app.settings GUCs are not set on this project, so triggers reading them
-- never sent anything (fixed by 20261015211000 and 20261015213000). Each must
-- take its credentials from push_cron_config instead.
SELECT ok(
  pg_get_functiondef(format('public.%s()', fn)::regprocedure) ILIKE '%push_cron_config%'
  AND pg_get_functiondef(format('public.%s()', fn)::regprocedure) NOT ILIKE '%app.settings%',
  fn || ' takes its push credentials from push_cron_config'
)
FROM unnest(ARRAY[
  'notify_invoicing_company_changed',
  'notify_direct_message',
  'notify_expense_status_change'
]) AS fn;

-- A synchronous extensions.http() call made every direct-message insert wait
-- on the network; notifications go through pg_net.
SELECT ok(
  pg_get_functiondef('public.notify_direct_message()'::regprocedure) ILIKE '%net.http_post%'
  AND pg_get_functiondef('public.notify_direct_message()'::regprocedure) NOT ILIKE '%extensions.http(%',
  'direct-message notifications are sent asynchronously through pg_net'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.jobs'::regclass
      AND tgfoid = 'public.notify_invoicing_company_changed()'::regprocedure
      AND NOT tgisinternal
  ),
  'jobs still fires the invoicing-company notification trigger'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.direct_messages'::regclass
      AND tgfoid = 'public.notify_direct_message()'::regprocedure
      AND NOT tgisinternal
  ),
  'direct_messages still fires the message notification trigger'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.job_expenses'::regclass
      AND tgfoid = 'public.notify_expense_status_change()'::regprocedure
      AND NOT tgisinternal
  ),
  'job_expenses still fires the expense status notification trigger'
);

SELECT * FROM finish();
