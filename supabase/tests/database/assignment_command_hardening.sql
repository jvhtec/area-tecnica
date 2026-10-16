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

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES
  ('d0110000-0000-0000-0000-000000000001', 'h-manager@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('d0110000-0000-0000-0000-000000000002', 'h-sound@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('d0110000-0000-0000-0000-000000000003', 'h-prod@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('d0110000-0000-0000-0000-000000000004', 'h-logi@test.local', '{}', '{}', 'authenticated', 'authenticated');
-- The production/logistics profiles carry a default category that differs
-- from their role's R/E/T suffix, to show which one pays.
INSERT INTO profiles (id, email, first_name, last_name, role, department, default_timesheet_category) VALUES
  ('d0110000-0000-0000-0000-000000000001', 'h-manager@test.local', 'Hard', 'Manager', 'management', 'sound', NULL),
  ('d0110000-0000-0000-0000-000000000002', 'h-sound@test.local', 'Hard', 'Sound', 'technician', 'sound', NULL),
  ('d0110000-0000-0000-0000-000000000003', 'h-prod@test.local', 'Hard', 'Prod', 'technician', 'production', 'especialista'),
  ('d0110000-0000-0000-0000-000000000004', 'h-logi@test.local', 'Hard', 'Logi', 'technician', 'logistics', 'responsable')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department,
  default_timesheet_category = excluded.default_timesheet_category;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false
FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed', 'timesheet.approved']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO rate_cards_2025 (category, base_day_eur, plus_10_12_eur, overtime_hour_eur)
VALUES ('responsable', 150, 20, 25), ('especialista', 125, 18, 22)
ON CONFLICT (category) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('d0210000-0000-0000-0000-000000000001', 'Hardening A', '2027-01-11 08:00:00+01', '2027-01-13 20:00:00+01', 'single', 'Confirmado'),
  ('d0210000-0000-0000-0000-000000000002', 'Hardening B', '2027-01-11 08:00:00+01', '2027-01-13 20:00:00+01', 'single', 'Confirmado'),
  ('d0210000-0000-0000-0000-000000000003', 'Hardening tour', '2027-01-18 08:00:00+01', '2027-01-18 20:00:00+01', 'single', 'Confirmado');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'd0110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"d0110000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE results (name text PRIMARY KEY, value jsonb);

CREATE FUNCTION pg_temp.apply(p_command uuid, p_job uuid, p_tech uuid, p_role text, p_dates date[], p_mode text DEFAULT 'replace',
  p_from uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.apply_direct_assignment(p_command, p_job, p_tech, p_role, 'invited', 'multi', p_dates, p_mode, pg_temp.tok(p_job, p_tech), p_from,
    CASE WHEN p_from IS NOT NULL THEN pg_temp.tok(p_from, p_tech) END, 'allow', 'assignment-dialog', NULL, '{}'::jsonb);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.apply(uuid, uuid, uuid, text, date[], text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Authoritative roles
-- ---------------------------------------------------------------------------
SELECT is((SELECT count(*) FROM assignment_role_codes), 30::bigint, 'the role registry holds every assignable code');
INSERT INTO results SELECT 'label', pg_temp.apply('d0310000-0000-0000-0000-000000000001', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'FOH Engineer', ARRAY['2027-01-11']::date[]);
SELECT is((SELECT value->>'code' FROM results WHERE name = 'label'), 'invalid_role', 'free-text legacy labels are refused');
INSERT INTO results SELECT 'fake', pg_temp.apply('d0310000-0000-0000-0000-000000000002', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'SND-FOH-T', ARRAY['2027-01-11']::date[]);
SELECT is((SELECT value->>'code' FROM results WHERE name = 'fake'), 'invalid_role', 'well-formed but unregistered codes are refused');
INSERT INTO results SELECT 'cross', pg_temp.apply('d0310000-0000-0000-0000-000000000003', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'PROD-RESP-R', ARRAY['2027-01-11']::date[]);
SELECT is((SELECT value->>'code' FROM results WHERE name = 'cross'), 'role_department_mismatch', 'a sound technician cannot take a production role');

-- ---------------------------------------------------------------------------
-- Production / logistics roles are staffing labels, never compensation
-- ---------------------------------------------------------------------------
-- Their pay stays on the pre-existing mechanism (here the profile default
-- category seeded above).
RESET ROLE;
SELECT ok(assignment_role_category(ARRAY['PROD-RESP-R', 'PROD-AYUD-T', 'PROD-COND-T']) IS NULL,
  'production roles never select a compensation category');
SELECT is(assignment_role_category(ARRAY['SND-FOH-R', 'LGT-PA-T', 'VID-CAM-E']), 'responsable',
  'sound/lights/video roles keep their R/E/T semantics');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'prod', pg_temp.apply('d0310000-0000-0000-0000-000000000004', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000003', 'PROD-RESP-R', ARRAY['2027-01-11']::date[]);
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'assignment'->>'production_role' = 'PROD-RESP-R' FROM results WHERE name = 'prod'),
  'a production technician takes a production role');
SELECT is((SELECT category FROM timesheets WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000003'),
  'especialista', 'Responsable de Producción keeps the profile category, not responsable');
INSERT INTO results SELECT 'logi', pg_temp.apply('d0310000-0000-0000-0000-000000000005', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000004', 'PROD-AYUD-T', ARRAY['2027-01-12']::date[]);
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'assignment'->>'production_role' = 'PROD-AYUD-T' FROM results WHERE name = 'logi'),
  'logistics staff take production roles');
SELECT is((SELECT category FROM timesheets WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000004'),
  'responsable', 'a logistics Ayudante keeps the profile category, not tecnico');
INSERT INTO results SELECT 'prod_role', public.change_assignment_role('d0310000-0000-0000-0000-000000000006', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000003', 'production', 'PROD-AYUD-T', true, pg_temp.tok('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000003'));
SELECT ok((SELECT value->>'outcome' = 'committed' AND value->'assignment'->>'production_role' = 'PROD-AYUD-T' FROM results WHERE name = 'prod_role'),
  'a production role change commits');
SELECT is((SELECT category FROM timesheets WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000003'),
  'especialista', 'a production role change does not recategorize the days');
INSERT INTO results SELECT 'prod_mismatch', public.change_assignment_role('d0310000-0000-0000-0000-000000000007', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000003', 'sound', 'SND-FOH-R', true, pg_temp.tok('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000003'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'prod_mismatch'), 'role_department_mismatch',
  'a role column outside the technician discipline is refused');
RESET ROLE;
-- Neither the category trigger nor the amount engine reads production roles.
UPDATE job_assignments SET production_role = 'PROD-RESP-R'
WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000003';
SELECT is(resolve_category_for_timesheet('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000003'),
  'especialista', 'the category resolver ignores the production role');
INSERT INTO timesheets (job_id, technician_id, date) VALUES
  ('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000003', '2027-01-13');
SELECT is((SELECT category FROM timesheets WHERE job_id = 'd0210000-0000-0000-0000-000000000001'
  AND technician_id = 'd0110000-0000-0000-0000-000000000003' AND date = '2027-01-13'), 'especialista',
  'a new timesheet for a production responsable is autofilled from the profile, not the role');
UPDATE timesheets SET start_time = '09:00', end_time = '17:00'
WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000003' AND date = '2027-01-13';
SELECT ok((SELECT r->'amount_breakdown'->>'category' = 'especialista' AND (r->'amount_breakdown'->>'base_day_eur')::numeric = 125
  FROM (SELECT compute_timesheet_amount_2025((SELECT id FROM timesheets WHERE job_id = 'd0210000-0000-0000-0000-000000000001'
    AND technician_id = 'd0110000-0000-0000-0000-000000000003' AND date = '2027-01-13'), false) AS r) x),
  'the amount engine prices a production responsable on the profile category, not the responsable rate card');
-- The amount engine's own role fallback (no stored category) ignores it too.
UPDATE timesheets SET category = NULL
WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000003' AND date = '2027-01-13';
SELECT ok((SELECT r->'amount_breakdown'->>'category' IS DISTINCT FROM 'responsable'
  FROM (SELECT compute_timesheet_amount_2025((SELECT id FROM timesheets WHERE job_id = 'd0210000-0000-0000-0000-000000000001'
    AND technician_id = 'd0110000-0000-0000-0000-000000000003' AND date = '2027-01-13'), false) AS r) x),
  'the amount fallback never derives responsable from a production role');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Approved timesheets are never deleted or voided by a command
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'a_setup', pg_temp.apply('d0310000-0000-0000-0000-000000000010', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'SND-FOH-R', ARRAY['2027-01-11', '2027-01-12']::date[]);
RESET ROLE;
UPDATE timesheets SET approved_by_manager = true, notes = 'approved'
WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000002' AND date = '2027-01-11';
CREATE TEMP TABLE approved_before AS
  SELECT jsonb_agg(to_jsonb(t) ORDER BY date) AS rows FROM timesheets t
  WHERE job_id = 'd0210000-0000-0000-0000-000000000001' AND technician_id = 'd0110000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'a_replace', pg_temp.apply('d0310000-0000-0000-0000-000000000011', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'SND-FOH-R', ARRAY['2027-01-12', '2027-01-13']::date[]);
SELECT ok((SELECT value->>'code' = 'approved_timesheet' AND value->'details'->'dates' = '["2027-01-11"]'::jsonb FROM results WHERE name = 'a_replace'),
  'replacing coverage cannot drop an approved day');
INSERT INTO results SELECT 'a_date', public.remove_assignment_date('d0310000-0000-0000-0000-000000000012', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', '2027-01-11', pg_temp.tok('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'a_date'), 'approved_timesheet', 'an approved day cannot be removed');
INSERT INTO results SELECT 'a_remove', public.remove_direct_assignment('d0310000-0000-0000-0000-000000000013', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', pg_temp.tok('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'a_remove'), 'approved_timesheet', 'a membership with approved days cannot be removed');
INSERT INTO results SELECT 'a_move', pg_temp.apply('d0310000-0000-0000-0000-000000000014', 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000002', 'SND-FOH-R', ARRAY['2027-01-12']::date[], 'replace', 'd0210000-0000-0000-0000-000000000001');
SELECT is((SELECT value->>'code' FROM results WHERE name = 'a_move'), 'approved_timesheet', 'a membership with approved days cannot be moved away');
INSERT INTO results SELECT 'a_decline', public.set_assignment_status('d0310000-0000-0000-0000-000000000015', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'decline', pg_temp.tok('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->>'code' FROM results WHERE name = 'a_decline'), 'approved_timesheet', 'a decline cannot void approved days');
INSERT INTO results SELECT 'a_add', pg_temp.apply('d0310000-0000-0000-0000-000000000016', 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000002', 'SND-FOH-R', ARRAY['2027-01-13']::date[], 'add');
SELECT is((SELECT value->>'outcome' FROM results WHERE name = 'a_add'), 'committed', 'adding days around approved ones still works');
RESET ROLE;
SELECT ok((SELECT rows FROM approved_before)->0 = (SELECT to_jsonb(t) FROM timesheets t WHERE job_id = 'd0210000-0000-0000-0000-000000000001'
  AND technician_id = 'd0110000-0000-0000-0000-000000000002' AND date = '2027-01-11'), 'the approved row is byte-for-byte unchanged');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Status no-ops write nothing; tour declines plan Flex removal
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 's_confirm', public.set_assignment_status('d0310000-0000-0000-0000-000000000020', 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000004', 'confirm', pg_temp.tok('d0210000-0000-0000-0000-000000000002', 'd0110000-0000-0000-0000-000000000004'));
RESET ROLE;
INSERT INTO job_assignments (job_id, technician_id, status, response_time, production_role)
VALUES ('d0210000-0000-0000-0000-000000000002', 'd0110000-0000-0000-0000-000000000004', 'confirmed', '2027-01-01 10:00:00+01', 'PROD-AYUD-T');
CREATE TEMP TABLE status_before AS SELECT to_jsonb(a) AS row FROM job_assignments a
WHERE job_id = 'd0210000-0000-0000-0000-000000000002' AND technician_id = 'd0110000-0000-0000-0000-000000000004';
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 's_noop', public.set_assignment_status('d0310000-0000-0000-0000-000000000021', 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000004', 'confirm', pg_temp.tok('d0210000-0000-0000-0000-000000000002', 'd0110000-0000-0000-0000-000000000004'));
SELECT ok((SELECT value->>'outcome' = 'noop' AND value->'side_effects' = '[]'::jsonb FROM results WHERE name = 's_noop'),
  'confirming a confirmed assignment is a no-op without a notification');
RESET ROLE;
SELECT ok((SELECT row FROM status_before) = (SELECT to_jsonb(a) FROM job_assignments a
  WHERE job_id = 'd0210000-0000-0000-0000-000000000002' AND technician_id = 'd0110000-0000-0000-0000-000000000004'),
  'the no-op keeps response_time and every other field');
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE metadata->>'command_id' = 'd0310000-0000-0000-0000-000000000021'), 0::bigint,
  'the no-op writes no audit row');
INSERT INTO job_assignments (job_id, technician_id, status, assignment_source, sound_role)
VALUES ('d0210000-0000-0000-0000-000000000003', 'd0110000-0000-0000-0000-000000000002', 'invited', 'tour', 'SND-FOH-R');
INSERT INTO timesheets (job_id, technician_id, date)
VALUES ('d0210000-0000-0000-0000-000000000003', 'd0110000-0000-0000-0000-000000000002', '2027-01-18');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 's_tour', public.set_assignment_status('d0310000-0000-0000-0000-000000000022', 'd0210000-0000-0000-0000-000000000003',
  'd0110000-0000-0000-0000-000000000002', 'decline', pg_temp.tok('d0210000-0000-0000-0000-000000000003', 'd0110000-0000-0000-0000-000000000002'));
SELECT is((SELECT value->'side_effects' FROM results WHERE name = 's_tour'),
  '[{"kind": "flex", "action": "remove", "job_id": "d0210000-0000-0000-0000-000000000003", "status": "pending", "department": "sound",
     "effect_id": "d0310000-0000-0000-0000-000000000022:0"}]'::jsonb,
  'a declined tour membership is taken off the Flex crew');

-- ---------------------------------------------------------------------------
-- A move that changes nothing is a no-op
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'm_first', pg_temp.apply('d0310000-0000-0000-0000-000000000030', 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003', 'PROD-RESP-R', ARRAY['2027-01-12']::date[], 'replace', 'd0210000-0000-0000-0000-000000000003');
INSERT INTO results SELECT 'm_again', pg_temp.apply('d0310000-0000-0000-0000-000000000031', 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003', 'PROD-RESP-R', ARRAY['2027-01-12']::date[], 'replace', 'd0210000-0000-0000-0000-000000000003');
SELECT ok((SELECT value->>'outcome' = 'noop' AND value->'side_effects' = '[]'::jsonb FROM results WHERE name = 'm_again'),
  'repeating a completed move is a no-op with no duplicate notification');

-- ---------------------------------------------------------------------------
-- Job-level state tokens
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'states', public.get_job_assignment_command_states('d0210000-0000-0000-0000-000000000001');
SELECT is((SELECT value->'states'->>'d0110000-0000-0000-0000-000000000002' FROM results WHERE name = 'states'),
  public.get_assignment_command_state('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000002')->>'state_token',
  'per-job tokens match the pair token');
SELECT is((SELECT value->>'absent_state_token' FROM results WHERE name = 'states'),
  public.get_assignment_command_state('d0210000-0000-0000-0000-000000000003', 'd0110000-0000-0000-0000-000000000004')->>'state_token',
  'the absent token matches a pair with nothing yet');

-- ---------------------------------------------------------------------------
-- Interactive callers must send the state they decided on
-- ---------------------------------------------------------------------------
SELECT throws_ok($$ SELECT public.remove_direct_assignment(gen_random_uuid(), 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003') $$, '22023', 'an expected state token is required', 'removal without a token is refused');
SELECT throws_ok($$ SELECT public.set_assignment_status(gen_random_uuid(), 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003', 'confirm') $$, '22023', 'an expected state token is required', 'status change without a token is refused');
SELECT throws_ok($$ SELECT public.change_assignment_role(gen_random_uuid(), 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003', 'production', 'PROD-AYUD-T') $$, '22023', 'an expected state token is required', 'role change without a token is refused');
SELECT throws_ok($$ SELECT public.remove_assignment_date(gen_random_uuid(), 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003', '2027-01-12') $$, '22023', 'an expected state token is required', 'date removal without a token is refused');
SELECT throws_ok($$ SELECT public.apply_direct_assignment(gen_random_uuid(), 'd0210000-0000-0000-0000-000000000001',
  'd0110000-0000-0000-0000-000000000003', 'PROD-RESP-R', 'invited', 'multi', ARRAY['2027-01-12']::date[], 'replace',
  pg_temp.tok('d0210000-0000-0000-0000-000000000001', 'd0110000-0000-0000-0000-000000000003'), 'd0210000-0000-0000-0000-000000000002') $$,
  '22023', 'an expected state token is required', 'a move without the source token is refused');
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT lives_ok($$ SELECT public.set_assignment_status(gen_random_uuid(), 'd0210000-0000-0000-0000-000000000002',
  'd0110000-0000-0000-0000-000000000003', 'confirm') $$, 'trusted service callers may omit the token');

SELECT * FROM finish();
ROLLBACK;
