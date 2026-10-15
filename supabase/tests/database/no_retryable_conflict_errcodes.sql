CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(2);

-- PostgREST retries SQLSTATE 40001 (serialization_failure) and 40P01
-- (deadlock_detected) forever inside the same request. An application-level
-- conflict raised with either code never succeeds on retry and pins a pooled
-- connection in a tight loop. Raise PT409 (HTTP 409) instead.
SELECT is_empty(
  $$ SELECT p.oid::regprocedure::text
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND pg_get_functiondef(p.oid) ~* 'errcode\s*=\s*''(40001|40P01)''' $$,
  'no public function raises a SQLSTATE that PostgREST retries'
);

SELECT isnt_empty(
  $$ SELECT 1
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'save_hoja_de_ruta'
       AND pg_get_functiondef(p.oid) ~ 'errcode = ''PT409''' $$,
  'save_hoja_de_ruta reports stale versions as PT409'
);

SELECT * FROM finish();
