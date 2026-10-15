CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(2);

-- The app.settings GUCs are not set on this project, so a trigger reading them
-- returned before sending anything (fixed by 20261015211000).
SELECT ok(
  pg_get_functiondef('public.notify_invoicing_company_changed()'::regprocedure) ILIKE '%push_cron_config%'
  AND pg_get_functiondef('public.notify_invoicing_company_changed()'::regprocedure) NOT ILIKE '%app.settings%',
  'invoicing-company notifications take their push credentials from push_cron_config'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.jobs'::regclass
      AND tgfoid = 'public.notify_invoicing_company_changed()'::regprocedure
      AND NOT tgisinternal
  ),
  'jobs still fires the invoicing-company notification trigger'
);

SELECT * FROM finish();
