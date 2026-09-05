-- Guard all application tables, not a hand-picked sample. This adds catalog
-- authorization coverage, not a claim of exhaustive per-table row-policy tests.
\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(11);

CREATE FUNCTION public.audit_default_acl_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1';
SELECT ok(NOT has_function_privilege('anon', 'public.audit_default_acl_probe()', 'EXECUTE'),
  'new postgres-owned functions do not inherit PUBLIC EXECUTE');
CREATE TABLE public.audit_default_table_probe (id integer);
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_default_table_probe', 'TRUNCATE,REFERENCES,TRIGGER'),
  'new application tables do not reintroduce non-CRUD privileges');

SELECT is((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated')) roles(name)
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid AND d.deptype = 'e')
    AND has_table_privilege(roles.name, c.oid, 'TRUNCATE,REFERENCES,TRIGGER')),
  0::bigint, 'no application relation grants client roles non-CRUD privileges');
SELECT ok(EXISTS (SELECT 1 FROM pg_class
  WHERE oid = 'public.v_truck_planner_technician_published_plans'::regclass
    AND 'security_invoker=true' = ANY(reloptions)),
  'technician published plans use caller RLS');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.set_job_created_by()'::regprocedure),
  'creator attribution does not elevate privileges');
SELECT ok(NOT has_function_privilege('anon', 'public.set_job_created_by()', 'EXECUTE'),
  'creator trigger is not an anonymous RPC');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.jobs'::regclass
  AND tgname = 'trg_jobs_set_created_by' AND tgenabled = 'O'
  AND tgfoid = 'public.set_job_created_by()'::regprocedure), 'jobs has the enabled creator trigger');

-- Exercise the actual trigger function without invoking unrelated job side
-- effects. The catalog assertion above verifies its production table attachment.
CREATE TEMP TABLE attribution_fixture (id integer, created_by uuid);
CREATE TRIGGER attribution BEFORE INSERT ON attribution_fixture
  FOR EACH ROW EXECUTE FUNCTION public.set_job_created_by();
GRANT INSERT, SELECT ON attribution_fixture TO authenticated;
SELECT set_config('request.jwt.claim.sub', 'ea100000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
INSERT INTO attribution_fixture VALUES (1, NULL), (2, 'ea100000-0000-0000-0000-000000000002');
SELECT is((SELECT created_by FROM attribution_fixture WHERE id = 1),
  'ea100000-0000-0000-0000-000000000001'::uuid, 'authenticated inserts get the caller identity');
SELECT is((SELECT created_by FROM attribution_fixture WHERE id = 2),
  'ea100000-0000-0000-0000-000000000002'::uuid, 'explicit attribution is preserved');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
INSERT INTO attribution_fixture VALUES (3, NULL);
SELECT is((SELECT created_by FROM attribution_fixture WHERE id = 3), NULL::uuid,
  'service inserts without an end-user do not invent attribution');
SELECT ok(has_table_privilege('service_role', 'public.jobs', 'INSERT'),
  'service operations retain their existing CRUD grants');
SELECT * FROM finish();
ROLLBACK;
