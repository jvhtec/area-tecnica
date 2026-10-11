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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.unconfirm_assignment(uuid,uuid,uuid,text,text,uuid,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.supersede_assignment_side_effects(uuid[])', 'EXECUTE'),
  'anonymous clients cannot undo anything');
SELECT ok(has_function_privilege('authenticated', 'public.unconfirm_assignment(uuid,uuid,uuid,text,text,uuid,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.supersede_assignment_side_effects(uuid[])', 'EXECUTE'),
  'signed-in managers can call the undo commands');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES
  ('a0110000-0000-0000-0000-000000000001', 'mu-manager@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('a0110000-0000-0000-0000-000000000002', 'mu-tech@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('a0110000-0000-0000-0000-000000000003', 'mu-manager2@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('a0110000-0000-0000-0000-000000000004', 'mu-noprofile@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department) VALUES
  ('a0110000-0000-0000-0000-000000000001', 'mu-manager@test.local', 'Undo', 'Manager', 'management', 'sound'),
  ('a0110000-0000-0000-0000-000000000002', 'mu-tech@test.local', 'Undo', 'Tech', 'technician', 'sound'),
  ('a0110000-0000-0000-0000-000000000003', 'mu-manager2@test.local', 'Undo', 'Manager2', 'management', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false
FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed', 'timesheet.approved']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('a0210000-0000-0000-0000-000000000001', 'Undo job', '2027-01-11 08:00:00+01', '2027-01-12 20:00:00+01', 'single', 'Confirmado'),
  ('a0210000-0000-0000-0000-000000000002', 'Undo approved job', '2027-01-18 08:00:00+01', '2027-01-18 20:00:00+01', 'single', 'Confirmado'),
  ('a0210000-0000-0000-0000-000000000003', 'Undo declined job', '2027-01-25 08:00:00+01', '2027-01-25 20:00:00+01', 'single', 'Confirmado'),
  ('a0210000-0000-0000-0000-000000000004', 'Undo dryhire job', '2027-02-01 08:00:00+01', '2027-02-01 20:00:00+01', 'dryhire', 'Confirmado'),
  ('a0210000-0000-0000-0000-000000000005', 'Undo effects job', '2027-02-08 08:00:00+01', '2027-02-08 20:00:00+01', 'single', 'Confirmado');
INSERT INTO job_assignments (job_id, technician_id, status) VALUES
  ('a0210000-0000-0000-0000-000000000004', 'a0110000-0000-0000-0000-000000000002', 'confirmed');

-- ---------------------------------------------------------------------------
-- Authorization: technicians, signed-in users without a profile and callers
-- with no role claim at all are all refused (fail closed).
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0110000-0000-0000-0000-000000000002"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.unconfirm_assignment('a0310000-0000-0000-0000-000000000001', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', 'any-token') $$, '42501', 'permission denied', 'a technician cannot unconfirm');
SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY['a0310000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'permission denied', 'a technician cannot supersede effects');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-000000000004', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0110000-0000-0000-0000-000000000004"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.unconfirm_assignment('a0310000-0000-0000-0000-000000000002', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', 'any-token') $$, '42501', 'permission denied', 'an identity without a profile cannot unconfirm');
SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY['a0310000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'permission denied', 'an identity without a profile cannot supersede effects');
RESET ROLE;

SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.unconfirm_assignment('a0310000-0000-0000-0000-000000000003', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', 'any-token') $$, '42501', 'permission denied', 'a caller with no claims cannot unconfirm');
SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY['a0310000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'permission denied', 'a caller with no claims cannot supersede effects');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- unconfirm_assignment
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0110000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE results (name text PRIMARY KEY, value jsonb);

SELECT throws_ok($$ SELECT public.unconfirm_assignment('a0310000-0000-0000-0000-000000000010', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002') $$, '22023', 'an expected state token is required', 'a state token is required');

INSERT INTO results SELECT 'missing', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000011', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', pg_temp.tok('a0210000-0000-0000-0000-000000000001', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'missing'), 'assignment_not_found', 'there must be a membership to reopen');

INSERT INTO results SELECT 'dryhire', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000012', 'a0210000-0000-0000-0000-000000000004',
  'a0110000-0000-0000-0000-000000000002', pg_temp.tok('a0210000-0000-0000-0000-000000000004', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'dryhire'), 'dryhire_job', 'dry-hire jobs are excluded');

SELECT ok((public.apply_direct_assignment('a0310000-0000-0000-0000-000000000013', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', 'SND-PA-T', 'invited', 'full', NULL, 'replace',
  pg_temp.tok('a0210000-0000-0000-0000-000000000001', 'a0110000-0000-0000-0000-000000000002'))->>'ok')::boolean, 'fixture: invited membership');
INSERT INTO results SELECT 'noop_invited', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000014', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', pg_temp.tok('a0210000-0000-0000-0000-000000000001', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'outcome' FROM results WHERE name = 'noop_invited'), 'noop', 'an invited assignment is already open: no-op');

INSERT INTO results SELECT 'confirm', public.set_assignment_status('a0310000-0000-0000-0000-000000000015', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', 'confirm', pg_temp.tok('a0210000-0000-0000-0000-000000000001', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->'assignment'->>'status' FROM results WHERE name = 'confirm'), 'confirmed', 'fixture: confirmed');

INSERT INTO results SELECT 'stale', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000016', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', (SELECT value->>'prior_state_token' FROM results WHERE name = 'confirm'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'stale'), 'stale_state', 'a token from before the confirm is stale');

INSERT INTO results SELECT 'unconfirm', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000017', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', (SELECT value->>'state_token' FROM results WHERE name = 'confirm'), 'matrix-undo');
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'assignment'->>'status' = 'invited'
  AND jsonb_array_length(value->'side_effects') = 1 AND value->'dates' = '["2027-01-11", "2027-01-12"]'::jsonb
  FROM results WHERE name = 'unconfirm'), 'standalone unconfirm commits, keeps the schedule and plans invited compensation');
SELECT ok((SELECT value->>'state_token' = (SELECT value->>'prior_state_token' FROM results WHERE name = 'confirm')
  FROM results WHERE name = 'unconfirm'), 'the resulting state equals the state before the confirm');
INSERT INTO results SELECT 'replay', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000017', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', (SELECT value->>'state_token' FROM results WHERE name = 'confirm'), 'matrix-undo');
SELECT ok((SELECT (value->>'replayed')::boolean FROM results WHERE name = 'replay'), 'a transport retry replays the committed outcome');
SELECT throws_ok($$ SELECT public.unconfirm_assignment('a0310000-0000-0000-0000-000000000017', 'a0210000-0000-0000-0000-000000000001',
  'a0110000-0000-0000-0000-000000000002', 'another-token') $$, '23505', 'command_id_reused', 'reusing the id for another decision is refused');
RESET ROLE;
SELECT is((SELECT response_time FROM job_assignments WHERE job_id = 'a0210000-0000-0000-0000-000000000001'), NULL::timestamptz,
  'the confirmation timestamp is cleared');
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE action = 'unconfirmed' AND job_id = 'a0210000-0000-0000-0000-000000000001'), 1::bigint,
  'the committed unconfirm is audited once');
SELECT is((SELECT side_effects_status FROM assignment_commands WHERE command_id = 'a0310000-0000-0000-0000-000000000017'), 'pending',
  'the ledger records standalone invited compensation');
SET LOCAL ROLE authenticated;

-- A decline cannot be reopened by this command.
RESET ROLE;
INSERT INTO job_assignments (job_id, technician_id, status) VALUES
  ('a0210000-0000-0000-0000-000000000003', 'a0110000-0000-0000-0000-000000000002', 'declined');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'declined', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000018', 'a0210000-0000-0000-0000-000000000003',
  'a0110000-0000-0000-0000-000000000002', pg_temp.tok('a0210000-0000-0000-0000-000000000003', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'declined'), 'invalid_transition', 'a declined assignment is not reopened');
RESET ROLE;
SELECT is((SELECT status::text FROM job_assignments WHERE job_id = 'a0210000-0000-0000-0000-000000000003'), 'declined', 'the rejection wrote nothing');

-- Approved days block reopening.
SET LOCAL ROLE authenticated;
SELECT ok((public.apply_direct_assignment('a0310000-0000-0000-0000-000000000019', 'a0210000-0000-0000-0000-000000000002',
  'a0110000-0000-0000-0000-000000000002', 'SND-PA-T', 'confirmed', 'full', NULL, 'replace',
  pg_temp.tok('a0210000-0000-0000-0000-000000000002', 'a0110000-0000-0000-0000-000000000002'))->>'ok')::boolean, 'fixture: confirmed with a day');
RESET ROLE;
UPDATE timesheets SET approved_by_manager = true
WHERE job_id = 'a0210000-0000-0000-0000-000000000002' AND technician_id = 'a0110000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'approved', public.unconfirm_assignment('a0310000-0000-0000-0000-000000000020', 'a0210000-0000-0000-0000-000000000002',
  'a0110000-0000-0000-0000-000000000002', pg_temp.tok('a0210000-0000-0000-0000-000000000002', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'approved'), 'approved_timesheet', 'approved days block reopening a confirmation');
RESET ROLE;
SELECT is((SELECT status::text FROM job_assignments WHERE job_id = 'a0210000-0000-0000-0000-000000000002'), 'confirmed', 'the approved assignment stays confirmed');

-- ---------------------------------------------------------------------------
-- supersede_assignment_side_effects
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0110000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY[]::uuid[]) $$, '22023', 'between 1 and 32 command ids are required', 'an empty list is refused');
SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY['a0310000-0000-0000-0000-0000000000ff']::uuid[]) $$,
  'P0002', 'unknown assignment command', 'an unknown command is refused');

-- A direct assignment plans a Flex add and a notification, none of them run yet.
INSERT INTO results SELECT 'effects', public.apply_direct_assignment('a0310000-0000-0000-0000-000000000030', 'a0210000-0000-0000-0000-000000000005',
  'a0110000-0000-0000-0000-000000000002', 'SND-FOH-E', 'invited', 'full', NULL, 'replace',
  pg_temp.tok('a0210000-0000-0000-0000-000000000005', 'a0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT jsonb_array_length(value->'side_effects') FROM results WHERE name = 'effects'), 2, 'fixture: two planned effects');

-- Another manager cannot cancel them.
SELECT set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0110000-0000-0000-0000-000000000003"}', true);
SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY['a0310000-0000-0000-0000-000000000030']::uuid[]) $$,
  '42501', 'permission denied', 'only the command author can supersede its effects');

SELECT set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0110000-0000-0000-0000-000000000001"}', true);
SELECT throws_ok($$ SELECT public.supersede_assignment_side_effects(ARRAY['a0310000-0000-0000-0000-000000000030']::uuid[]) $$,
  '22023', 'verified unclaimed undo required', 'the author cannot cancel an ordinary command without verified atomic undo');
RESET ROLE;
SELECT is((SELECT side_effects_status FROM assignment_commands WHERE command_id = 'a0310000-0000-0000-0000-000000000030'), 'pending',
  'refused supersession preserves the ordinary effect plan');
SELECT is((SELECT count(*) FROM assignment_command_undos WHERE original_command_id = 'a0310000-0000-0000-0000-000000000030'), 0::bigint,
  'public supersession never manufactures an undo relationship');
SELECT * FROM finish();
ROLLBACK;
