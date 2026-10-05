\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
CREATE FUNCTION pg_temp.tok(p_job uuid, p_tech uuid) RETURNS text LANGUAGE sql AS $tok$
  SELECT public.get_assignment_command_state(p_job, p_tech)->>'state_token';
$tok$;
GRANT EXECUTE ON FUNCTION pg_temp.tok(uuid, uuid) TO authenticated;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

SELECT ok(NOT has_function_privilege('anon', 'public.remove_direct_assignment(uuid,uuid,uuid,text,text,uuid,jsonb)', 'EXECUTE'),
  'anonymous clients cannot remove assignments');
SELECT ok(NOT has_function_privilege('anon', 'public.remove_assignment_date(uuid,uuid,uuid,date,text,text,uuid,jsonb)', 'EXECUTE'),
  'anonymous clients cannot remove days');
SELECT ok(has_function_privilege('authenticated', 'public.remove_direct_assignment(uuid,uuid,uuid,text,text,uuid,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.remove_assignment_date(uuid,uuid,uuid,date,text,text,uuid,jsonb)', 'EXECUTE'),
  'signed-in managers can call removal commands');

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES
  ('db110000-0000-0000-0000-000000000001', 'db-manager@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('db110000-0000-0000-0000-000000000002', 'db-tech@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department) VALUES
  ('db110000-0000-0000-0000-000000000001', 'db-manager@test.local', 'Removal', 'Manager', 'management', 'sound'),
  ('db110000-0000-0000-0000-000000000002', 'db-tech@test.local', 'Removal', 'Tech', 'technician', 'lights')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false
FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('db210000-0000-0000-0000-000000000001', 'Removal A', '2026-11-16 08:00:00+01', '2026-11-19 20:00:00+01', 'single', 'Confirmado'),
  ('db210000-0000-0000-0000-000000000002', 'Removal orphan', '2026-11-16 08:00:00+01', '2026-11-16 20:00:00+01', 'single', 'Confirmado');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'db110000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"db110000-0000-0000-0000-000000000002"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.remove_direct_assignment('db310000-0000-0000-0000-000000000001', 'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002')) $$,
  '42501', 'permission denied', 'a technician cannot remove assignments');
SELECT throws_ok($$ SELECT public.remove_assignment_date('db310000-0000-0000-0000-000000000001', 'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-16', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002')) $$,
  '42501', 'permission denied', 'a technician cannot remove days');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'db110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"db110000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
SELECT ok((public.apply_direct_assignment('db310000-0000-0000-0000-000000000010', 'db210000-0000-0000-0000-000000000001',
  'db110000-0000-0000-0000-000000000002', 'LGT-BRD-R', 'confirmed', 'multi', ARRAY['2026-11-16', '2026-11-17', '2026-11-18']::date[], 'replace', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002'))->>'ok')::boolean,
  'fixture membership with three days');
CREATE TEMP TABLE results (name text PRIMARY KEY, value jsonb);

-- ---------------------------------------------------------------------------
-- Date removal
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'first_day', public.remove_assignment_date('db310000-0000-0000-0000-000000000011',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-16',
  public.get_assignment_command_state('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002')->>'state_token');
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'dates' = '["2026-11-17", "2026-11-18"]'::jsonb FROM results WHERE name = 'first_day'),
  'removing one day keeps every other day');
SELECT ok((SELECT value->'assignment'->>'assignment_date' = '2026-11-17' AND (value->'assignment'->>'single_day')::boolean
  FROM results WHERE name = 'first_day'), 'the scoped day moves to the first remaining day');
INSERT INTO results SELECT 'first_day_replay', public.remove_assignment_date('db310000-0000-0000-0000-000000000011',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-16',
  (SELECT value->>'prior_state_token' FROM results WHERE name = 'first_day'));
SELECT ok((SELECT (value->>'replayed')::boolean AND value->>'outcome' = 'committed' FROM results WHERE name = 'first_day_replay'),
  'a retried date removal replays instead of failing as stale');
INSERT INTO results SELECT 'stale_day', public.remove_assignment_date('db310000-0000-0000-0000-000000000012',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-17',
  (SELECT value->>'prior_state_token' FROM results WHERE name = 'first_day'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'stale_day'), 'stale_state', 'a stale date removal is rejected');
INSERT INTO results SELECT 'absent_day', public.remove_assignment_date('db310000-0000-0000-0000-000000000013',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-19', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'outcome' FROM results WHERE name = 'absent_day'), 'noop', 'removing an unscheduled day is a no-op');
SELECT lives_ok($$ SELECT public.remove_assignment_date('db310000-0000-0000-0000-000000000014',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-18', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002')) $$, 'second day removal commits');
INSERT INTO results SELECT 'last_day', public.remove_assignment_date('db310000-0000-0000-0000-000000000015',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-17', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'last_day'), 'last_date', 'the last day of a membership is never removed as a date');
RESET ROLE;
SELECT results_eq($$ SELECT date FROM timesheets WHERE job_id = 'db210000-0000-0000-0000-000000000001' AND is_active $$,
  $$ VALUES ('2026-11-17'::date) $$, 'membership keeps its remaining day');
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE action = 'date_removed' AND job_id = 'db210000-0000-0000-0000-000000000001'), 2::bigint,
  'each committed day removal is audited');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Whole removal
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'stale_remove', public.remove_direct_assignment('db310000-0000-0000-0000-000000000016',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002',
  (SELECT value->>'state_token' FROM results WHERE name = 'first_day'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'stale_remove'), 'stale_state', 'a stale removal is rejected');
INSERT INTO results SELECT 'remove', public.remove_direct_assignment('db310000-0000-0000-0000-000000000017',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002',
  public.get_assignment_command_state('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002')->>'state_token');
SELECT ok((SELECT value->>'outcome' = 'committed' AND (value->'removed'->>'deleted_assignment')::boolean
    AND (value->'removed'->>'deleted_timesheets')::integer = 1 AND value->'dates' = '[]'::jsonb FROM results WHERE name = 'remove'),
  'whole removal deletes membership and schedule together');
SELECT is((SELECT value->'side_effects' FROM results WHERE name = 'remove'),
  '[{"kind": "flex", "action": "remove", "job_id": "db210000-0000-0000-0000-000000000001", "status": "pending", "department": "lights",
     "effect_id": "db310000-0000-0000-0000-000000000017:0"},
    {"kind": "notification", "action": "assignment.removed", "job_id": "db210000-0000-0000-0000-000000000001", "status": "pending",
     "effect_id": "db310000-0000-0000-0000-000000000017:1"}]'::jsonb,
  'removal plans Flex removal and the removal notification');
INSERT INTO results SELECT 'remove_again', public.remove_direct_assignment('db310000-0000-0000-0000-000000000018',
  'db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', pg_temp.tok('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002'));
SELECT ok((SELECT value->>'outcome' = 'noop' AND value->'side_effects' = '[]'::jsonb FROM results WHERE name = 'remove_again'),
  'removing an absent membership is a no-op');
RESET ROLE;
SELECT ok((SELECT count(*) = 0 FROM job_assignments WHERE job_id = 'db210000-0000-0000-0000-000000000001')
  AND (SELECT count(*) = 0 FROM timesheets WHERE job_id = 'db210000-0000-0000-0000-000000000001'), 'nothing remains for the pair');

-- Orphan schedule rows (no membership) are removed by whole removal and are
-- removable day by day without the last-day guard.
INSERT INTO timesheets (job_id, technician_id, date) VALUES
  ('db210000-0000-0000-0000-000000000002', 'db110000-0000-0000-0000-000000000002', '2026-11-16');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'orphan', public.remove_direct_assignment('db310000-0000-0000-0000-000000000019',
  'db210000-0000-0000-0000-000000000002', 'db110000-0000-0000-0000-000000000002', pg_temp.tok('db210000-0000-0000-0000-000000000002', 'db110000-0000-0000-0000-000000000002'));
SELECT ok((SELECT value->>'outcome' = 'committed' AND NOT (value->'removed'->>'deleted_assignment')::boolean
  AND (value->'removed'->>'deleted_timesheets')::integer = 1 FROM results WHERE name = 'orphan'), 'orphan schedule rows are cleaned up');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Existing writers keep their contracts under the shared lock order
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT lives_ok($$ SELECT public.toggle_timesheet_day('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002', '2026-11-16', true, 'matrix') $$,
  'toggle still creates a day');
SELECT ok((SELECT count(*) = 1 FROM job_assignments WHERE job_id = 'db210000-0000-0000-0000-000000000001')
  AND (SELECT count(*) = 1 FROM timesheets WHERE job_id = 'db210000-0000-0000-0000-000000000001' AND is_active), 'toggle still ensures membership');
SELECT results_eq($$ SELECT * FROM public.remove_assignment_with_timesheets('db210000-0000-0000-0000-000000000001', 'db110000-0000-0000-0000-000000000002') $$,
  $$ VALUES (1, true) $$, 'remove_assignment_with_timesheets keeps its result contract');

SELECT * FROM finish();
ROLLBACK;
