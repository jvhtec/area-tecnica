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

SELECT ok(NOT has_function_privilege('anon', 'public.record_assignment_side_effects(uuid,uuid,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.claim_assignment_side_effects(uuid,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_assignment_consistency_issues(date,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_assignment_side_effect_backlog(integer,interval)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_assignment_command_metrics(timestamptz)', 'EXECUTE'),
  'anonymous clients cannot reach reconciliation or diagnostics');

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) VALUES
  ('dc110000-0000-0000-0000-000000000001', 'dc-tech@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department) VALUES
  ('dc110000-0000-0000-0000-000000000001', 'dc-tech@test.local', 'Recon', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false
FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('dc210000-0000-0000-0000-000000000001', 'Recon A', now() + interval '10 days', now() + interval '11 days', 'single', 'Confirmado'),
  ('dc210000-0000-0000-0000-000000000002', 'Recon B', now() + interval '10 days', now() + interval '11 days', 'single', 'Confirmado'),
  ('dc210000-0000-0000-0000-000000000003', 'Recon C', now() + interval '10 days', now() + interval '11 days', 'single', 'Confirmado'),
  ('dc210000-0000-0000-0000-000000000004', 'Recon dryhire', now() + interval '10 days', now() + interval '11 days', 'dryhire', 'Confirmado');

-- ---------------------------------------------------------------------------
-- Side-effect reporting
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE results (name text PRIMARY KEY, value jsonb);
INSERT INTO results SELECT 'apply', public.apply_direct_assignment('dc310000-0000-0000-0000-000000000001',
  'dc210000-0000-0000-0000-000000000001', 'dc110000-0000-0000-0000-000000000001', 'SND-FOH-R', 'invited', 'full', NULL, 'replace', pg_temp.tok('dc210000-0000-0000-0000-000000000001', 'dc110000-0000-0000-0000-000000000001'));
SELECT is((SELECT jsonb_array_length(value->'side_effects') FROM results WHERE name = 'apply'), 2, 'flex add + notification are planned');
SELECT is((SELECT side_effects_status FROM assignment_commands WHERE command_id = 'dc310000-0000-0000-0000-000000000001'), 'pending',
  'plan starts pending');
-- One runner claims the effects; a concurrent second runner gets nothing.
INSERT INTO results SELECT 'claim1', public.claim_assignment_side_effects('dc310000-0000-0000-0000-000000000001', 120);
SELECT is((SELECT jsonb_array_length(value->'effects') FROM results WHERE name = 'claim1'), 2, 'the first runner claims both pending effects');
SELECT ok((SELECT value->'effects'->0->>'index' = '0' AND value->'effects'->1->>'effect_id' = 'dc310000-0000-0000-0000-000000000001:1'
  FROM results WHERE name = 'claim1'), 'claimed effects carry their index and stable effect id');
INSERT INTO results SELECT 'claim2', public.claim_assignment_side_effects('dc310000-0000-0000-0000-000000000001', 120);
SELECT ok((SELECT jsonb_array_length(value->'effects') = 0 AND value->'claim_token' = 'null'::jsonb FROM results WHERE name = 'claim2'),
  'a concurrent retry claims nothing, so nothing is sent twice');
SELECT throws_ok($$ SELECT public.record_assignment_side_effects('dc310000-0000-0000-0000-000000000001',
  (SELECT (value->>'claim_token')::uuid FROM results WHERE name = 'claim1'),
  '[{"index": 0, "status": "failed"}, {"index": 0, "status": "succeeded"}]') $$,
  '22023', 'invalid side-effect result', 'a report may not list the same effect twice');
SELECT is((public.record_assignment_side_effects('dc310000-0000-0000-0000-000000000001', gen_random_uuid(),
  '[{"index": 0, "status": "succeeded"}]'))->'ignored_indexes', '[0]'::jsonb, 'a runner without the claim is ignored');
SELECT is((public.record_assignment_side_effects('dc310000-0000-0000-0000-000000000001',
  (SELECT (value->>'claim_token')::uuid FROM results WHERE name = 'claim1'),
  '[{"index": 0, "status": "failed", "error": "Flex timeout"}, {"index": 1, "status": "succeeded"}]'))->>'side_effects_status', 'failed',
  'a failed Flex call marks the command failed');
SELECT is((SELECT count(*) FROM get_assignment_side_effect_backlog(50, interval '5 minutes')
  WHERE command_id = 'dc310000-0000-0000-0000-000000000001'), 1::bigint, 'failed effects appear in the reconciliation backlog');
SELECT ok((SELECT side_effects->0->>'last_error' = 'Flex timeout' AND (side_effects->0->>'attempts')::integer = 1
  AND side_effects->0->>'claim_token' IS NULL FROM assignment_commands WHERE command_id = 'dc310000-0000-0000-0000-000000000001'),
  'error and attempt count are kept and the claim is released');
INSERT INTO results SELECT 'claim3', public.claim_assignment_side_effects('dc310000-0000-0000-0000-000000000001', 120);
SELECT ok((SELECT jsonb_array_length(value->'effects') = 1 AND value->'effects'->0->>'index' = '0' FROM results WHERE name = 'claim3'),
  'a retry claims only the failed effect; the delivered notification is never re-run');
SELECT is((public.record_assignment_side_effects('dc310000-0000-0000-0000-000000000001',
  (SELECT (value->>'claim_token')::uuid FROM results WHERE name = 'claim3'),
  '[{"index": 0, "status": "succeeded"}]'))->>'side_effects_status', 'succeeded', 'a successful retry closes the command');
SELECT is((SELECT count(*) FROM get_assignment_side_effect_backlog(50, interval '5 minutes')
  WHERE command_id = 'dc310000-0000-0000-0000-000000000001'), 0::bigint, 'reconciled commands leave the backlog');
-- An abandoned claim (tab closed mid-run) expires and the effect is claimable again.
UPDATE assignment_commands
SET side_effects = jsonb_set(side_effects, '{0}', side_effects->0 || '{"status": "pending", "claim_token": "00000000-0000-0000-0000-000000000000", "claimed_until": "2000-01-01T00:00:00Z"}')
WHERE command_id = 'dc310000-0000-0000-0000-000000000001';
SELECT is((public.claim_assignment_side_effects('dc310000-0000-0000-0000-000000000001', 120))->'effects'->0->>'index', '0',
  'an expired claim is reclaimable');
SELECT throws_ok($$ SELECT public.record_assignment_side_effects('dc310000-0000-0000-0000-000000000001', gen_random_uuid(), '[{"index": 9, "status": "succeeded"}]') $$,
  '22023', 'invalid side-effect result', 'out-of-range effect index is refused');
SELECT throws_ok($$ SELECT public.claim_assignment_side_effects('dc3100ff-0000-0000-0000-000000000001', 120) $$,
  'P0002', 'unknown assignment command', 'unknown command is refused');
SELECT ok((SELECT commands >= 1 FROM get_assignment_command_metrics(now() - interval '1 hour')
  WHERE command_type = 'apply_direct_assignment' AND outcome = 'committed'), 'metrics count committed commands');

-- ---------------------------------------------------------------------------
-- Consistency diagnostics
-- ---------------------------------------------------------------------------
INSERT INTO job_assignments (job_id, technician_id, status) VALUES
  ('dc210000-0000-0000-0000-000000000002', 'dc110000-0000-0000-0000-000000000001', 'invited'),
  ('dc210000-0000-0000-0000-000000000004', 'dc110000-0000-0000-0000-000000000001', 'invited');
INSERT INTO timesheets (job_id, technician_id, date) VALUES
  ('dc210000-0000-0000-0000-000000000003', 'dc110000-0000-0000-0000-000000000001', (now() + interval '10 days')::date);
UPDATE job_assignments SET assignment_date = (now() + interval '20 days')::date, single_day = true
WHERE job_id = 'dc210000-0000-0000-0000-000000000001';
SELECT results_eq($$ SELECT issue, job_id FROM get_assignment_consistency_issues(NULL, 200)
  WHERE technician_id = 'dc110000-0000-0000-0000-000000000001' ORDER BY issue $$,
  $$ VALUES ('membership_without_schedule'::text, 'dc210000-0000-0000-0000-000000000002'::uuid),
            ('schedule_without_membership'::text, 'dc210000-0000-0000-0000-000000000003'::uuid),
            ('scoped_date_not_scheduled'::text, 'dc210000-0000-0000-0000-000000000001'::uuid) $$,
  'diagnostics find each inconsistency class and ignore dry-hire memberships');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'dc110000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"dc110000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT * FROM get_assignment_consistency_issues(NULL, 10) $$, '42501', 'permission denied',
  'technicians cannot read diagnostics');
SELECT throws_ok($$ SELECT public.claim_assignment_side_effects('dc310000-0000-0000-0000-000000000001', 120) $$, '42501', 'permission denied',
  'technicians cannot claim side effects');
SELECT is((SELECT count(*) FROM assignment_commands), 0::bigint, 'technicians cannot read the ledger');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
