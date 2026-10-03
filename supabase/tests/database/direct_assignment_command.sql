\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
SELECT set_config('request.jwt.claim.role', 'service_role', true);

-- ---------------------------------------------------------------------------
-- Contract and privileges
-- ---------------------------------------------------------------------------
SELECT ok(to_regprocedure('public.apply_direct_assignment(uuid,uuid,uuid,text,text,text,date[],text,text,uuid,text,text,text,uuid,jsonb)') IS NOT NULL,
  'atomic direct assignment command exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_direct_assignment(uuid,uuid,uuid,text,text,text,date[],text,text,uuid,text,text,text,uuid,jsonb)'::regprocedure),
  'command is security definer with its own authorization');
SELECT ok(NOT has_function_privilege('anon', 'public.apply_direct_assignment(uuid,uuid,uuid,text,text,text,date[],text,text,uuid,text,text,text,uuid,jsonb)', 'EXECUTE'),
  'anonymous clients cannot call the command');
SELECT ok(has_function_privilege('authenticated', 'public.apply_direct_assignment(uuid,uuid,uuid,text,text,text,date[],text,text,uuid,text,text,text,uuid,jsonb)', 'EXECUTE'),
  'signed-in managers can call the command');
SELECT ok(NOT has_function_privilege('authenticated', 'public.assignment_remove_membership_locked(uuid,uuid)', 'EXECUTE'),
  'internal removal helper is not callable by clients');
SELECT ok(NOT has_function_privilege('authenticated', 'public.assignment_command_reject(uuid,text,uuid,uuid,uuid,uuid,text,jsonb,text,text,text,jsonb,text)', 'EXECUTE'),
  'internal rejection helper is not callable by clients');
SELECT ok(NOT has_table_privilege('authenticated', 'public.assignment_commands', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.assignment_commands', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.assignment_commands', 'DELETE'),
  'the ledger is written only through commands');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES
  ('da110000-0000-0000-0000-000000000001', 'da-manager@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('da110000-0000-0000-0000-000000000002', 'da-tech@test.local', '{}', '{}', 'authenticated', 'authenticated'),
  ('da110000-0000-0000-0000-000000000003', 'da-lights@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department) VALUES
  ('da110000-0000-0000-0000-000000000001', 'da-manager@test.local', 'Direct', 'Manager', 'management', 'sound'),
  ('da110000-0000-0000-0000-000000000002', 'da-tech@test.local', 'Direct', 'Tech', 'technician', 'sound'),
  ('da110000-0000-0000-0000-000000000003', 'da-lights@test.local', 'Direct', 'Lights', 'technician', 'lights')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false
FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed', 'timesheet.approved']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('da210000-0000-0000-0000-000000000001', 'Direct A', '2026-11-02 08:00:00+01', '2026-11-05 20:00:00+01', 'single', 'Confirmado'),
  ('da210000-0000-0000-0000-000000000002', 'Direct B', '2026-11-02 08:00:00+01', '2026-11-05 20:00:00+01', 'single', 'Confirmado'),
  -- Ends at 00:30 Madrid on the 11th (23:30 UTC on the 10th): full coverage must include the 11th.
  ('da210000-0000-0000-0000-000000000003', 'Direct overnight', '2026-11-09 18:00:00+01', '2026-11-11 00:30:00+01', 'single', 'Confirmado'),
  ('da210000-0000-0000-0000-000000000004', 'Direct other', '2026-11-02 08:00:00+01', '2026-11-05 20:00:00+01', 'single', 'Confirmado'),
  ('da210000-0000-0000-0000-000000000005', 'Direct tourdate', '2026-11-02 08:00:00+01', '2026-11-02 20:00:00+01', 'tourdate', 'Confirmado');

-- Act as a management user (actor attribution comes from auth.uid()).
CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', p_user)::text, true);
END;
$$;
CREATE FUNCTION pg_temp.apply(
  p_command uuid, p_job uuid, p_tech uuid, p_role text, p_status text, p_coverage text, p_dates date[],
  p_mode text DEFAULT 'replace', p_token text DEFAULT NULL, p_from uuid DEFAULT NULL,
  p_policy text DEFAULT 'reject'
) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.apply_direct_assignment(p_command, p_job, p_tech, p_role, p_status, p_coverage, p_dates,
    p_mode, p_token, p_from, NULL, p_policy, 'assignment-dialog', NULL, '{}'::jsonb);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.act_as(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.apply(uuid, uuid, uuid, text, text, text, date[], text, text, uuid, text) TO authenticated;
CREATE TEMP TABLE results (name text PRIMARY KEY, value jsonb);
GRANT ALL ON results TO authenticated;

-- ---------------------------------------------------------------------------
-- Authorization
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('da110000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT pg_temp.apply('da310000-0000-0000-0000-000000000001', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'confirmed', 'single', ARRAY['2026-11-02']::date[]) $$,
  '42501', 'permission denied', 'a technician cannot assign');
SELECT throws_ok($$ SELECT public.get_assignment_command_state('da210000-0000-0000-0000-000000000001', 'da110000-0000-0000-0000-000000000002') $$,
  '42501', 'permission denied', 'a technician cannot read command state');
RESET ROLE;

SELECT pg_temp.act_as('da110000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT throws_ok($$ SELECT pg_temp.apply('da310000-0000-0000-0000-000000000002', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'confirmed', 'single', ARRAY['2026-11-02', '2026-11-03']::date[]) $$,
  '22023', 'valid coverage dates are required', 'single coverage needs exactly one date');
SELECT throws_ok($$ SELECT pg_temp.apply('da310000-0000-0000-0000-000000000002', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', '  ', 'confirmed', 'single', ARRAY['2026-11-02']::date[]) $$,
  '22023', 'a role is required', 'a role is required');

-- ---------------------------------------------------------------------------
-- Create (single day)
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'create', pg_temp.apply('da310000-0000-0000-0000-000000000010', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'single', ARRAY['2026-11-03']::date[]);
SELECT is((SELECT value->>'outcome' FROM results WHERE name = 'create'), 'committed', 'single-day assignment commits');
SELECT ok((SELECT status = 'invited' AND single_day AND assignment_date = '2026-11-03' AND sound_role = 'SND-FOH-R'
    AND assignment_source = 'direct' AND assigned_by = 'da110000-0000-0000-0000-000000000001'
  FROM job_assignments WHERE job_id = 'da210000-0000-0000-0000-000000000001' AND technician_id = 'da110000-0000-0000-0000-000000000002'),
  'membership carries role, scope and actor');
SELECT results_eq($$ SELECT date, is_active, source, category FROM timesheets
  WHERE job_id = 'da210000-0000-0000-0000-000000000001' AND technician_id = 'da110000-0000-0000-0000-000000000002' $$,
  $$ VALUES ('2026-11-03'::date, true, 'assignment-dialog'::text, 'responsable'::text) $$,
  'schedule and role category are written in the same transaction');
SELECT is((SELECT value->'side_effects' FROM results WHERE name = 'create'),
  '[{"kind": "flex", "action": "add", "job_id": "da210000-0000-0000-0000-000000000001", "status": "pending", "department": "sound"},
    {"kind": "notification", "action": "job.assignment.direct", "job_id": "da210000-0000-0000-0000-000000000001", "status": "pending"}]'::jsonb,
  'post-commit plan lists Flex and notification effects');
SELECT is((SELECT value->>'state_token' FROM results WHERE name = 'create'),
  (SELECT public.get_assignment_command_state('da210000-0000-0000-0000-000000000001', 'da110000-0000-0000-0000-000000000002')->>'state_token'),
  'result token matches the readable state token');
RESET ROLE;
SELECT ok((SELECT outcome = 'committed' AND side_effects_status = 'pending' AND actor_id = 'da110000-0000-0000-0000-000000000001'
  FROM assignment_commands WHERE command_id = 'da310000-0000-0000-0000-000000000010'), 'ledger records the committed command');
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE metadata->>'command_id' = 'da310000-0000-0000-0000-000000000010' AND action = 'direct_assigned'),
  1::bigint, 'audit log records the assignment with its command id');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Idempotency
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'replay', pg_temp.apply('da310000-0000-0000-0000-000000000010', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'single', ARRAY['2026-11-03']::date[]);
SELECT ok((SELECT (value->>'replayed')::boolean AND value - 'replayed' = (SELECT value - 'replayed' FROM results WHERE name = 'create')
  FROM results WHERE name = 'replay'), 'a transport retry replays the original result');
SELECT throws_ok($$ SELECT pg_temp.apply('da310000-0000-0000-0000-000000000010', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-MON-R', 'invited', 'single', ARRAY['2026-11-03']::date[]) $$,
  '23505', 'command_id_reused', 'reusing a command id for a different request is refused');
INSERT INTO results SELECT 'noop', pg_temp.apply('da310000-0000-0000-0000-000000000011', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'single', ARRAY['2026-11-03']::date[]);
SELECT ok((SELECT value->>'outcome' = 'noop' AND value->'side_effects' = '[]'::jsonb FROM results WHERE name = 'noop'),
  'the same decision under a new command id is a no-op without side effects');
RESET ROLE;
SELECT is((SELECT count(*) FROM job_assignments WHERE job_id = 'da210000-0000-0000-0000-000000000001'), 1::bigint, 'still exactly one membership');
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE metadata->>'command_id' = 'da310000-0000-0000-0000-000000000011'), 0::bigint, 'no-op writes no audit row');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Expected state (stale tab)
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'token_before', to_jsonb(value->>'state_token') FROM results WHERE name = 'create';
RESET ROLE;
UPDATE job_assignments SET sound_role = 'SND-MON-E' WHERE job_id = 'da210000-0000-0000-0000-000000000001';
CREATE TEMP TABLE stale_snapshot AS
  SELECT (SELECT to_jsonb(a) FROM job_assignments a WHERE job_id = 'da210000-0000-0000-0000-000000000001') AS membership,
         (SELECT jsonb_agg(to_jsonb(t) ORDER BY date) FROM timesheets t WHERE job_id = 'da210000-0000-0000-0000-000000000001') AS schedule;
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'stale', pg_temp.apply('da310000-0000-0000-0000-000000000012', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'confirmed', 'multi', ARRAY['2026-11-03', '2026-11-04']::date[],
  'replace', (SELECT value #>> '{}' FROM results WHERE name = 'token_before'));
SELECT ok((SELECT value->>'code' = 'stale_state' AND NOT (value->>'ok')::boolean FROM results WHERE name = 'stale'),
  'a stale expected state is rejected');
RESET ROLE;
SELECT ok((SELECT to_jsonb(a) FROM job_assignments a WHERE job_id = 'da210000-0000-0000-0000-000000000001') = (SELECT membership FROM stale_snapshot)
  AND (SELECT jsonb_agg(to_jsonb(t) ORDER BY date) FROM timesheets t WHERE job_id = 'da210000-0000-0000-0000-000000000001') = (SELECT schedule FROM stale_snapshot),
  'a stale rejection writes nothing');
SELECT ok((SELECT outcome = 'rejected' AND error_code = 'stale_state' AND side_effects_status = 'none'
  FROM assignment_commands WHERE command_id = 'da310000-0000-0000-0000-000000000012'), 'stale rejection is ledgered');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'stale_replay', pg_temp.apply('da310000-0000-0000-0000-000000000012', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'confirmed', 'multi', ARRAY['2026-11-03', '2026-11-04']::date[],
  'replace', (SELECT value #>> '{}' FROM results WHERE name = 'token_before'));
SELECT ok((SELECT value->>'code' = 'stale_state' AND (value->>'replayed')::boolean FROM results WHERE name = 'stale_replay'),
  'replaying a rejected command returns the same rejection');

-- ---------------------------------------------------------------------------
-- Confirm, then an invited retry must not downgrade
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'confirm', pg_temp.apply('da310000-0000-0000-0000-000000000013', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'confirmed', 'single', ARRAY['2026-11-03']::date[], 'replace',
  public.get_assignment_command_state('da210000-0000-0000-0000-000000000001', 'da110000-0000-0000-0000-000000000002')->>'state_token');
SELECT is((SELECT value->'assignment'->>'status' FROM results WHERE name = 'confirm'), 'confirmed', 'direct confirmation commits');
INSERT INTO results SELECT 'invited_retry', pg_temp.apply('da310000-0000-0000-0000-000000000014', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'single', ARRAY['2026-11-03']::date[]);
SELECT ok((SELECT value->>'outcome' = 'noop' AND value->'assignment'->>'status' = 'confirmed' FROM results WHERE name = 'invited_retry'),
  'an invited retry never downgrades a confirmed membership');

-- ---------------------------------------------------------------------------
-- Add / replace coverage
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'add', pg_temp.apply('da310000-0000-0000-0000-000000000015', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'confirmed', 'multi', ARRAY['2026-11-05', '2026-11-04']::date[], 'add');
SELECT is((SELECT value->'dates' FROM results WHERE name = 'add'), '["2026-11-03", "2026-11-04", "2026-11-05"]'::jsonb,
  'add mode keeps existing days and adds the new ones');
SELECT ok((SELECT single_day AND assignment_date = '2026-11-03' FROM job_assignments WHERE job_id = 'da210000-0000-0000-0000-000000000001'),
  'add mode preserves the original scoped day');
RESET ROLE;
UPDATE timesheets SET approved_by_manager = true, category = 'tecnico', notes = 'approved'
WHERE job_id = 'da210000-0000-0000-0000-000000000001' AND date = '2026-11-05';
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'replace', pg_temp.apply('da310000-0000-0000-0000-000000000016', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000002', 'SND-MON-E', 'confirmed', 'multi', ARRAY['2026-11-04', '2026-11-05']::date[], 'replace');
SELECT ok((SELECT value->'dates' = '["2026-11-04", "2026-11-05"]'::jsonb AND value->'removed_dates' = '["2026-11-03"]'::jsonb
  FROM results WHERE name = 'replace'), 'replace mode removes days outside the new coverage');
SELECT ok((SELECT single_day AND assignment_date = '2026-11-04' AND sound_role = 'SND-MON-E' FROM job_assignments
  WHERE job_id = 'da210000-0000-0000-0000-000000000001'), 'replace mode rescopes compatibility fields to the first day');
SELECT results_eq($$ SELECT date, category FROM timesheets WHERE job_id = 'da210000-0000-0000-0000-000000000001' ORDER BY date $$,
  $$ VALUES ('2026-11-04'::date, 'especialista'::text), ('2026-11-05'::date, 'tecnico'::text) $$,
  'role change recategorizes unapproved days and leaves approved days untouched');

-- ---------------------------------------------------------------------------
-- Full coverage is derived server-side in Europe/Madrid
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'full', pg_temp.apply('da310000-0000-0000-0000-000000000017', 'da210000-0000-0000-0000-000000000003',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'full', NULL);
SELECT is((SELECT value->'dates' FROM results WHERE name = 'full'), '["2026-11-09", "2026-11-10", "2026-11-11"]'::jsonb,
  'full coverage spans every Madrid calendar day of the job');
SELECT ok((SELECT NOT single_day AND assignment_date IS NULL FROM job_assignments WHERE job_id = 'da210000-0000-0000-0000-000000000003'),
  'full coverage is unscoped');

-- ---------------------------------------------------------------------------
-- Conflicts are enforced under the lock
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'conflict', pg_temp.apply('da310000-0000-0000-0000-000000000018', 'da210000-0000-0000-0000-000000000004',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'multi', ARRAY['2026-11-02', '2026-11-04']::date[]);
SELECT ok((SELECT value->>'code' = 'conflict' AND value->'details'->>'target_date' = '2026-11-04'
    AND (value->'details'->'conflicts'->>'hasHardConflict')::boolean
    AND value->'details'->'conflicts'->'hardConflicts'->0->>'id' = 'da210000-0000-0000-0000-000000000001'
  FROM results WHERE name = 'conflict'), 'a schedule clash is rejected with the warning payload');
RESET ROLE;
SELECT is((SELECT count(*) FROM job_assignments WHERE job_id = 'da210000-0000-0000-0000-000000000004'), 0::bigint, 'a conflict rejection writes nothing');
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'override', pg_temp.apply('da310000-0000-0000-0000-000000000019', 'da210000-0000-0000-0000-000000000004',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-R', 'invited', 'multi', ARRAY['2026-11-02', '2026-11-04']::date[],
  'replace', NULL, NULL, 'allow');
SELECT ok((SELECT value->>'outcome' = 'committed' AND (value->>'conflict_override')::boolean FROM results WHERE name = 'override'),
  'an explicit manager override commits and is recorded');

-- ---------------------------------------------------------------------------
-- Move / reassign (job 4 -> job 2)
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'move', public.apply_direct_assignment('da310000-0000-0000-0000-000000000020', 'da210000-0000-0000-0000-000000000002',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-T', 'invited', 'single', ARRAY['2026-11-02']::date[], 'replace', NULL,
  'da210000-0000-0000-0000-000000000004',
  public.get_assignment_command_state('da210000-0000-0000-0000-000000000004', 'da110000-0000-0000-0000-000000000002')->>'state_token',
  'reject', 'assignment-dialog', NULL, '{}'::jsonb);
SELECT ok((SELECT value->>'outcome' = 'committed' AND (value->'moved_from'->>'deleted_assignment')::boolean
    AND (value->'moved_from'->>'deleted_timesheets')::integer = 2 FROM results WHERE name = 'move'),
  'a move removes the old membership and its schedule');
SELECT ok((SELECT value->'side_effects'->0 = '{"kind": "flex", "action": "remove", "job_id": "da210000-0000-0000-0000-000000000004", "department": "sound", "status": "pending"}'::jsonb
  FROM results WHERE name = 'move'), 'a move plans Flex removal from the old job');
RESET ROLE;
SELECT is((SELECT count(*) FROM job_assignments WHERE job_id = 'da210000-0000-0000-0000-000000000004'), 0::bigint, 'old job has no membership');
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'da210000-0000-0000-0000-000000000004'), 0::bigint, 'old job has no schedule');
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'da210000-0000-0000-0000-000000000002' AND is_active), 1::bigint, 'new job has the moved day');

-- A failure after the old membership was deleted rolls back the whole move.
CREATE FUNCTION pg_temp.fail_direct_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_id = 'da210000-0000-0000-0000-000000000004' THEN RAISE EXCEPTION 'injected direct schedule failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER direct_test_fail_schedule BEFORE INSERT OR UPDATE ON timesheets FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_direct_schedule();
CREATE TEMP TABLE before_failed_move AS
  SELECT (SELECT jsonb_agg(to_jsonb(a) ORDER BY job_id) FROM job_assignments a WHERE technician_id = 'da110000-0000-0000-0000-000000000002') AS memberships,
         (SELECT jsonb_agg(to_jsonb(t) ORDER BY job_id, date) FROM timesheets t WHERE technician_id = 'da110000-0000-0000-0000-000000000002') AS schedule;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT pg_temp.apply('da310000-0000-0000-0000-000000000021', 'da210000-0000-0000-0000-000000000004',
  'da110000-0000-0000-0000-000000000002', 'SND-FOH-T', 'invited', 'single', ARRAY['2026-11-02']::date[], 'replace', NULL,
  'da210000-0000-0000-0000-000000000002') $$, 'P0001', 'injected direct schedule failure', 'a mid-move failure propagates');
RESET ROLE;
SELECT ok((SELECT jsonb_agg(to_jsonb(a) ORDER BY job_id) FROM job_assignments a WHERE technician_id = 'da110000-0000-0000-0000-000000000002') = (SELECT memberships FROM before_failed_move)
  AND (SELECT jsonb_agg(to_jsonb(t) ORDER BY job_id, date) FROM timesheets t WHERE technician_id = 'da110000-0000-0000-0000-000000000002') = (SELECT schedule FROM before_failed_move),
  'a failed move leaves the old complete state, never a half-move');
SELECT is((SELECT count(*) FROM assignment_commands WHERE command_id = 'da310000-0000-0000-0000-000000000021'), 0::bigint,
  'a failed command leaves no ledger row, so its id can be retried');
DROP TRIGGER direct_test_fail_schedule ON timesheets;
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Entity and role validation
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'mismatch', pg_temp.apply('da310000-0000-0000-0000-000000000022', 'da210000-0000-0000-0000-000000000001',
  'da110000-0000-0000-0000-000000000003', 'SND-FOH-R', 'invited', 'single', ARRAY['2026-11-02']::date[]);
SELECT is((SELECT value->>'code' FROM results WHERE name = 'mismatch'), 'role_department_mismatch', 'a sound role cannot be given to a lights technician');
INSERT INTO results SELECT 'missing_job', pg_temp.apply('da310000-0000-0000-0000-000000000023', 'da210000-0000-0000-0000-0000000000ff',
  'da110000-0000-0000-0000-000000000003', 'LGT-BRD-R', 'invited', 'single', ARRAY['2026-11-02']::date[]);
SELECT is((SELECT value->>'code' FROM results WHERE name = 'missing_job'), 'job_not_found', 'a missing job is a rejection, not an error');

-- Tour dates keep schedule-only rows; lights roles plan a lights Flex add.
INSERT INTO results SELECT 'tourdate', pg_temp.apply('da310000-0000-0000-0000-000000000024', 'da210000-0000-0000-0000-000000000005',
  'da110000-0000-0000-0000-000000000003', 'LGT-BRD-R', 'confirmed', 'full', NULL);
SELECT ok((SELECT is_schedule_only AND is_active FROM timesheets WHERE job_id = 'da210000-0000-0000-0000-000000000005'), 'tourdate rows are schedule-only');
SELECT ok((SELECT value->'side_effects'->0->>'department' = 'lights' FROM results WHERE name = 'tourdate'), 'lights role plans a lights Flex add');

-- A new membership supersedes leftover inactive rows outside its coverage.
RESET ROLE;
INSERT INTO timesheets (job_id, technician_id, date, is_active)
VALUES ('da210000-0000-0000-0000-000000000004', 'da110000-0000-0000-0000-000000000003', '2026-11-05', false),
       ('da210000-0000-0000-0000-000000000004', 'da110000-0000-0000-0000-000000000003', '2026-11-03', false);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$ SELECT pg_temp.apply('da310000-0000-0000-0000-000000000025', 'da210000-0000-0000-0000-000000000004',
  'da110000-0000-0000-0000-000000000003', 'LGT-BRD-R', 'invited', 'single', ARRAY['2026-11-03']::date[]) $$, 'fresh assignment over leftovers commits');
SELECT results_eq($$ SELECT date, is_active FROM timesheets WHERE job_id = 'da210000-0000-0000-0000-000000000004'
  AND technician_id = 'da110000-0000-0000-0000-000000000003' $$,
  $$ VALUES ('2026-11-03'::date, true) $$, 'leftover row inside coverage is reactivated, the one outside is removed');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
