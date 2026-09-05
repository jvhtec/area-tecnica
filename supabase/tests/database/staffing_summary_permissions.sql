-- SEC-01: materialized payroll aggregates are private even when the source
-- tables have RLS. Clients must use the role-checked staffing RPC.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(19);

SELECT ok(NOT has_table_privilege('anon', 'public.v_job_staffing_summary', 'SELECT'),
  'anonymous clients cannot select the materialized payroll summary');
SELECT ok(NOT has_table_privilege('authenticated', 'public.v_job_staffing_summary', 'SELECT'),
  'authenticated clients cannot bypass the staffing RPC');
SELECT ok(has_table_privilege('service_role', 'public.v_job_staffing_summary', 'SELECT'),
  'service operations retain direct summary access');
SELECT ok(NOT has_function_privilege('anon', 'public.get_job_staffing_summary(uuid[])', 'EXECUTE'),
  'anonymous clients cannot execute the staffing RPC');
SELECT ok(has_function_privilege('authenticated', 'public.get_job_staffing_summary(uuid[])', 'EXECUTE'),
  'authenticated clients retain the guarded RPC entry point');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'm'
    AND (has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('authenticated', c.oid, 'SELECT'))
), 'no public materialized view exposes unfiltered data to client roles');

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, email, 'test',
  now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('e9100000-0000-0000-0000-000000000001'::uuid, 'summary-tech@test.local'),
  ('e9100000-0000-0000-0000-000000000002'::uuid, 'summary-manager@test.local'),
  ('e9100000-0000-0000-0000-000000000003'::uuid, 'summary-admin@test.local')
) AS fixtures(id, email);

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('e9100000-0000-0000-0000-000000000001', 'summary-tech@test.local', 'Summary', 'Tech', 'technician', 'sound'),
  ('e9100000-0000-0000-0000-000000000002', 'summary-manager@test.local', 'Summary', 'Manager', 'management', 'sound'),
  ('e9100000-0000-0000-0000-000000000003', 'summary-admin@test.local', 'Summary', 'Admin', 'admin', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time)
VALUES
  ('e9200000-0000-0000-0000-000000000001', 'Summary requested job', '2026-07-10T08:00:00Z', '2026-07-10T20:00:00Z'),
  ('e9200000-0000-0000-0000-000000000002', 'Summary unrequested job', '2026-07-11T08:00:00Z', '2026-07-11T20:00:00Z');
-- This test concerns visibility of a stored amount, not rate calculation.
INSERT INTO public.timesheets (job_id, technician_id, date, start_time, end_time, category, is_active, amount_eur)
VALUES ('e9200000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000001',
  '2026-07-10', '08:00', '20:00', 'tecnico', true, 125.50);
REFRESH MATERIALIZED VIEW public.v_job_staffing_summary;

-- Capture the authoritative aggregate before changing caller identities.
CREATE TEMP TABLE expected_staffing_summary AS
SELECT job_id, assigned_count, worked_count, total_cost_eur, approved_cost_eur
FROM public.v_job_staffing_summary
WHERE job_id = 'e9200000-0000-0000-0000-000000000001';
GRANT SELECT ON expected_staffing_summary TO authenticated, service_role;
SELECT is((SELECT total_cost_eur FROM expected_staffing_summary), 125.50::numeric,
  'the fixture contains a nonzero payroll aggregate');

-- Exercise the actual migration over populated profiles/jobs/payroll, including
-- the permissive grants found on production. This also verifies that replaying
-- the grant repair preserves existing cached values and authorized consumers.
-- The separate assertions above still verify the fresh migration chain.
GRANT SELECT ON TABLE public.v_job_staffing_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_staffing_summary(uuid[]) TO PUBLIC;
\ir ../../migrations/20260905094349_restrict_staffing_summary_access.sql

SELECT set_config('request.jwt.claim.role', 'anon', false);
SET ROLE anon;
SELECT throws_ok($$SELECT * FROM public.v_job_staffing_summary$$, '42501',
  'permission denied for materialized view v_job_staffing_summary', 'anonymous reads fail at the relation boundary');
SELECT throws_ok($$SELECT * FROM public.get_job_staffing_summary(ARRAY[]::uuid[])$$, '42501',
  'permission denied for function get_job_staffing_summary', 'anonymous RPC calls are denied');
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'e9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.v_job_staffing_summary$$, '42501',
  'permission denied for materialized view v_job_staffing_summary', 'technicians cannot read raw payroll aggregates');
SELECT throws_ok($$SELECT * FROM public.get_job_staffing_summary(ARRAY['e9200000-0000-0000-0000-000000000001']::uuid[])$$,
  '42501', 'permission denied', 'technicians cannot use the management RPC');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'e9100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.v_job_staffing_summary$$, '42501',
  'permission denied for materialized view v_job_staffing_summary', 'management also goes through the guarded RPC');
SELECT results_eq(
  $$SELECT * FROM public.get_job_staffing_summary(ARRAY['e9200000-0000-0000-0000-000000000001']::uuid[])$$,
  $$SELECT * FROM expected_staffing_summary$$, 'management receives exactly the requested aggregate including its costs');
SELECT is((SELECT count(*)::integer FROM public.get_job_staffing_summary(ARRAY[]::uuid[])), 0,
  'empty job selection does not enumerate all jobs');
SELECT is((SELECT count(*)::integer FROM public.get_job_staffing_summary(ARRAY['e9200000-0000-0000-0000-000000000099']::uuid[])), 0,
  'unknown job selection does not return unrelated jobs');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'e9100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;
SELECT results_eq(
  $$SELECT * FROM public.get_job_staffing_summary(ARRAY['e9200000-0000-0000-0000-000000000001']::uuid[])$$,
  $$SELECT * FROM expected_staffing_summary$$, 'admin retains the same scoped payroll aggregate');
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE service_role;
SELECT results_eq(
  $$SELECT job_id, assigned_count, worked_count, total_cost_eur, approved_cost_eur FROM public.v_job_staffing_summary
    WHERE job_id = 'e9200000-0000-0000-0000-000000000001'$$,
  $$SELECT * FROM expected_staffing_summary$$, 'service reads retain the complete aggregate');
SELECT results_eq(
  $$SELECT * FROM public.get_job_staffing_summary(ARRAY['e9200000-0000-0000-0000-000000000001']::uuid[])$$,
  $$SELECT * FROM expected_staffing_summary$$, 'service RPC access remains functional');
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.get_job_staffing_summary(ARRAY[]::uuid[])$$,
  '42501', 'permission denied', 'an authenticated role without a user identity cannot read the summary');
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT * FROM finish();
