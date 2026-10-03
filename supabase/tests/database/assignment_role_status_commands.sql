\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
SELECT set_config('request.jwt.claim.role', 'service_role', true);

SELECT ok(NOT has_function_privilege('anon', 'public.change_assignment_role(uuid,uuid,uuid,text,text,boolean,text,text,uuid,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_assignment_status(uuid,uuid,uuid,text,text,text,uuid,jsonb)', 'EXECUTE'),
  'anonymous clients cannot change roles or status');
SELECT ok(has_function_privilege('authenticated', 'public.change_assignment_role(uuid,uuid,uuid,text,text,boolean,text,text,uuid,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.set_assignment_status(uuid,uuid,uuid,text,text,text,uuid,jsonb)', 'EXECUTE'),
  'signed-in managers can call role/status commands');

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES
  ('de110000-0000-0000-0000-000000000001', 'de-manager@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('de110000-0000-0000-0000-000000000002', 'de-tech@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department) VALUES
  ('de110000-0000-0000-0000-000000000001', 'de-manager@test.local', 'Role', 'Manager', 'management', 'sound'),
  ('de110000-0000-0000-0000-000000000002', 'de-tech@test.local', 'Role', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false
FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed', 'timesheet.approved']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('de210000-0000-0000-0000-000000000001', 'Role job', '2026-12-07 08:00:00+01', '2026-12-08 20:00:00+01', 'single', 'Confirmado'),
  ('de210000-0000-0000-0000-000000000002', 'Clash job', '2026-12-07 08:00:00+01', '2026-12-07 20:00:00+01', 'single', 'Confirmado'),
  ('de210000-0000-0000-0000-000000000003', 'Tour job', '2026-12-14 08:00:00+01', '2026-12-14 20:00:00+01', 'single', 'Confirmado');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'de110000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"de110000-0000-0000-0000-000000000002"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.change_assignment_role('de310000-0000-0000-0000-000000000001', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-FOH-R') $$, '42501', 'permission denied', 'a technician cannot change roles');
SELECT throws_ok($$ SELECT public.set_assignment_status('de310000-0000-0000-0000-000000000001', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'confirm') $$, '42501', 'permission denied', 'the status command is manager-only');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'de110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"de110000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE results (name text PRIMARY KEY, value jsonb);

INSERT INTO results SELECT 'missing', public.change_assignment_role('de310000-0000-0000-0000-000000000002', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-FOH-R');
SELECT is((SELECT value->>'code' FROM results WHERE name = 'missing'), 'assignment_not_found', 'role change needs a membership');

SELECT ok((public.apply_direct_assignment('de310000-0000-0000-0000-000000000003', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'SND-PA-T', 'invited', 'full', NULL)->>'ok')::boolean, 'fixture membership');

-- ---------------------------------------------------------------------------
-- Role change
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'role', public.change_assignment_role('de310000-0000-0000-0000-000000000004', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-FOH-R', true,
  public.get_assignment_command_state('de210000-0000-0000-0000-000000000001', 'de110000-0000-0000-0000-000000000002')->>'state_token');
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'assignment'->>'sound_role' = 'SND-FOH-R'
  AND value->'side_effects' = '[]'::jsonb FROM results WHERE name = 'role'), 'role change commits without a Flex effect while the role stays present');
SELECT results_eq($$ SELECT DISTINCT category FROM timesheets WHERE job_id = 'de210000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('responsable'::text) $$, 'categories follow the new role in the same transaction');
INSERT INTO results SELECT 'role_noop', public.change_assignment_role('de310000-0000-0000-0000-000000000005', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-FOH-R');
SELECT is((SELECT value->>'outcome' FROM results WHERE name = 'role_noop'), 'noop', 'the same role is a no-op');
INSERT INTO results SELECT 'role_stale', public.change_assignment_role('de310000-0000-0000-0000-000000000006', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-MON-E', true, (SELECT value->>'prior_state_token' FROM results WHERE name = 'role'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'role_stale'), 'stale_state', 'a stale role change is rejected');
INSERT INTO results SELECT 'role_mismatch', public.change_assignment_role('de310000-0000-0000-0000-000000000007', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'LGT-BRD-R');
SELECT is((SELECT value->>'code' FROM results WHERE name = 'role_mismatch'), 'role_department_mismatch', 'a lights code cannot fill the sound column');
INSERT INTO results SELECT 'role_clear', public.change_assignment_role('de310000-0000-0000-0000-000000000008', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'none');
SELECT ok((SELECT value->'assignment'->>'sound_role' IS NULL
  AND value->'side_effects'->0->>'action' = 'remove' AND value->'side_effects'->0->>'department' = 'sound'
  FROM results WHERE name = 'role_clear'), 'clearing a sound role plans the Flex removal');
INSERT INTO results SELECT 'role_restore', public.change_assignment_role('de310000-0000-0000-0000-000000000009', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-MON-E', false);
SELECT ok((SELECT value->'side_effects'->0->>'action' = 'add' FROM results WHERE name = 'role_restore'), 'setting a sound role plans the Flex add');
SELECT results_eq($$ SELECT DISTINCT category FROM timesheets WHERE job_id = 'de210000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('responsable'::text) $$, 'category sync can be disabled per call');
INSERT INTO results SELECT 'role_replay', public.change_assignment_role('de310000-0000-0000-0000-000000000009', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'sound', 'SND-MON-E', false);
SELECT ok((SELECT (value->>'replayed')::boolean FROM results WHERE name = 'role_replay'), 'role change retries replay');
RESET ROLE;
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE action = 'role_changed' AND job_id = 'de210000-0000-0000-0000-000000000001'), 3::bigint,
  'each committed role change is audited');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------
RESET ROLE;
INSERT INTO job_assignments (job_id, technician_id, status) VALUES
  ('de210000-0000-0000-0000-000000000002', 'de110000-0000-0000-0000-000000000002', 'invited');
INSERT INTO timesheets (job_id, technician_id, date) VALUES
  ('de210000-0000-0000-0000-000000000002', 'de110000-0000-0000-0000-000000000002', '2026-12-07');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'confirm_conflict', public.set_assignment_status('de310000-0000-0000-0000-000000000010', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'confirm');
SELECT is((SELECT value->>'code' FROM results WHERE name = 'confirm_conflict'), 'conflict', 'confirmation with an overlapping schedule is rejected');
RESET ROLE;
SELECT is((SELECT status::text FROM job_assignments WHERE job_id = 'de210000-0000-0000-0000-000000000001'), 'invited', 'rejected confirmation writes nothing');
DELETE FROM job_assignments WHERE job_id = 'de210000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'confirm', public.set_assignment_status('de310000-0000-0000-0000-000000000011', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'confirm',
  public.get_assignment_command_state('de210000-0000-0000-0000-000000000001', 'de110000-0000-0000-0000-000000000002')->>'state_token');
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'assignment'->>'status' = 'confirmed'
  AND value->'side_effects'->0->>'action' = 'job.assignment.confirmed' FROM results WHERE name = 'confirm'),
  'confirmation commits and plans the confirmation notification');
INSERT INTO results SELECT 'decline', public.set_assignment_status('de310000-0000-0000-0000-000000000012', 'de210000-0000-0000-0000-000000000001',
  'de110000-0000-0000-0000-000000000002', 'decline');
SELECT ok((SELECT value->'assignment'->>'status' = 'declined' AND value->'dates' = '[]'::jsonb FROM results WHERE name = 'decline'),
  'a soft decline keeps membership and voids its schedule');
RESET ROLE;
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'de210000-0000-0000-0000-000000000001' AND NOT is_active), 2::bigint,
  'voided days are kept inactive');
INSERT INTO job_assignments (job_id, technician_id, status, assignment_source) VALUES
  ('de210000-0000-0000-0000-000000000003', 'de110000-0000-0000-0000-000000000002', 'invited', 'tour');
INSERT INTO timesheets (job_id, technician_id, date) VALUES
  ('de210000-0000-0000-0000-000000000003', 'de110000-0000-0000-0000-000000000002', '2026-12-14');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'tour_decline', public.set_assignment_status('de310000-0000-0000-0000-000000000013', 'de210000-0000-0000-0000-000000000003',
  'de110000-0000-0000-0000-000000000002', 'decline');
SELECT ok((SELECT value->'assignment' = 'null'::jsonb AND value->'lifecycle'->>'action' = 'hard_deleted' FROM results WHERE name = 'tour_decline'),
  'declining a tour membership removes it (decided server-side)');
INSERT INTO results SELECT 'decline_missing', public.set_assignment_status('de310000-0000-0000-0000-000000000014', 'de210000-0000-0000-0000-000000000003',
  'de110000-0000-0000-0000-000000000002', 'decline');
SELECT is((SELECT value->>'code' FROM results WHERE name = 'decline_missing'), 'assignment_not_found', 'status change needs a membership');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
