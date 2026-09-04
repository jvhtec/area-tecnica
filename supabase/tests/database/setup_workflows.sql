BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();

SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('af100000-0000-0000-0000-000000000001', 'setup-manager@test.local', '{}'),
  ('af100000-0000-0000-0000-000000000002', 'setup-tech@test.local', '{}');
INSERT INTO public.profiles (id, email, first_name, last_name, role, department) VALUES
  ('af100000-0000-0000-0000-000000000001', 'setup-manager@test.local', 'Setup', 'Manager', 'management', 'production'),
  ('af100000-0000-0000-0000-000000000002', 'setup-tech@test.local', 'Setup', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, department = EXCLUDED.department;
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false) ON CONFLICT (code) DO NOTHING;
INSERT INTO public.jobs (id, title, start_time, end_time) VALUES
  ('af200000-0000-0000-0000-000000000001', 'Setup workflow test', '2026-09-04 08:00:00Z', '2026-09-04 18:00:00Z'),
  ('af200000-0000-0000-0000-000000000002', 'Historical job', '2026-09-05 08:00:00Z', '2026-09-05 18:00:00Z');

SELECT ok(NOT has_table_privilege('anon', 'public.setup_workflows', 'SELECT'), 'anonymous callers cannot read workflows');
SELECT ok(NOT has_table_privilege('authenticated', 'public.setup_workflows', 'UPDATE'), 'direct lifecycle writes are denied');
SELECT ok(NOT has_table_privilege('authenticated', 'public.setup_workflow_tasks', 'INSERT'), 'direct task writes are denied');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sync_setup_workflow_tasks(uuid,jsonb)', 'EXECUTE'), 'internal sync cannot bypass parent lock');
SELECT ok(NOT has_function_privilege('anon', 'public.mutate_setup_workflow(text,jsonb,uuid)', 'EXECUTE'), 'anonymous RPC execution denied');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'af100000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT set_config('test.setup_tasks', '[
  {"task_key":"review","category":"review","label":"Revisión","required":true,"responsible_role":"management","metadata":{"note":"keep"}},
  {"task_key":"pesos:sound","category":"technical","label":"Pesos","required":false,"responsible_role":"technical","metadata":{}}
]', true);
SELECT set_config('test.setup_create', jsonb_build_object(
  'type', 'job', 'entity_id', 'af200000-0000-0000-0000-000000000001',
  'state', '{"basic":{"note":"saved"}}'::jsonb, 'tasks', current_setting('test.setup_tasks')::jsonb
)::text, true);
SELECT set_config('test.setup_id', (public.mutate_setup_workflow('create', current_setting('test.setup_create')::jsonb)).id::text, true);

SELECT is((SELECT count(*)::integer FROM public.setup_workflows), 1, 'management can create and read workflow');
SELECT is((SELECT count(*)::integer FROM public.setup_workflow_tasks), 2, 'initial tasks created atomically');
SELECT is((SELECT count(*)::integer FROM public.setup_workflows WHERE entity_id = 'af200000-0000-0000-0000-000000000002'), 0, 'historical entity does not require a workflow');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('create', current_setting('test.setup_create')::jsonb)$$,
  '23505', 'duplicate_workflow: an active workflow already exists', 'duplicate active creation rejected');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('create', jsonb_set(current_setting('test.setup_create')::jsonb, '{type}', '"other"'))$$,
  '22023', 'unknown_type: unsupported workflow type', 'unknown workflow type rejected');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('state', '{"state":{}}', 'af300000-0000-0000-0000-000000000099')$$,
  'P0002', 'missing_workflow: workflow not found', 'missing workflow is explicit');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"complete"}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'invalid_transition: workflow status change not allowed', 'draft cannot complete directly');
SELECT lives_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"in_progress"}', current_setting('test.setup_id')::uuid)$$,
  'draft can start');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"complete"}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'incomplete_workflow: required work or blockers remain', 'pending required tasks prevent completion');

SELECT public.mutate_setup_workflow('state', '{"state":{"resources":{"note":"second session"}}}', current_setting('test.setup_id')::uuid);
SELECT public.mutate_setup_workflow('step', '{"step":"technical"}', current_setting('test.setup_id')::uuid);
SELECT is((SELECT state FROM public.setup_workflows WHERE id = current_setting('test.setup_id')::uuid),
  '{"basic":{"note":"saved"},"resources":{"note":"second session"}}'::jsonb, 'state patches preserve other steps');
SELECT is((SELECT current_step FROM public.setup_workflows WHERE id = current_setting('test.setup_id')::uuid),
  'technical', 'current step persists independently of wizard state');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('step', '{"step":"dates"}', current_setting('test.setup_id')::uuid)$$,
  '23514', NULL, 'database rejects a step belonging to a different workflow type');

SELECT public.mutate_setup_workflow('task_status', '{"task_key":"review","status":"skipped"}', current_setting('test.setup_id')::uuid);
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"complete"}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'incomplete_workflow: required work or blockers remain', 'required skips prevent completion');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('task_status', '{"task_key":"review","status":"completed"}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'invalid_task_transition: task status change not allowed', 'skipped task must be reopened');
SELECT public.mutate_setup_workflow('task_status', '{"task_key":"review","status":"pending"}', current_setting('test.setup_id')::uuid);
SELECT public.mutate_setup_workflow('task_status', '{"task_key":"review","status":"completed"}', current_setting('test.setup_id')::uuid);
SELECT is((SELECT completed_by FROM public.setup_workflow_tasks WHERE task_key = 'review'),
  'af100000-0000-0000-0000-000000000001'::uuid, 'completion is attributed on the server');
SELECT set_config('test.completed_at', (SELECT completed_at::text FROM public.setup_workflow_tasks WHERE task_key = 'review'), true);
SELECT public.mutate_setup_workflow('sync', jsonb_build_object('tasks', current_setting('test.setup_tasks')::jsonb), current_setting('test.setup_id')::uuid);
SELECT public.mutate_setup_workflow('sync', jsonb_build_object('tasks', current_setting('test.setup_tasks')::jsonb), current_setting('test.setup_id')::uuid);
SELECT is((SELECT count(*)::integer FROM public.setup_workflow_tasks), 2, 'repeated sync does not duplicate tasks');
SELECT is((SELECT status FROM public.setup_workflow_tasks WHERE task_key = 'review'), 'completed', 'sync preserves completion');

SELECT public.mutate_setup_workflow('sync', '{"tasks":[]}', current_setting('test.setup_id')::uuid);
SELECT is((SELECT count(*)::integer FROM public.setup_workflow_tasks WHERE applicable), 0, 'removed requirements are retired');
SELECT is((SELECT count(*)::integer FROM public.setup_workflow_tasks), 2, 'retirement retains history');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"complete"}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'incomplete_workflow: required work or blockers remain', 'no applicable tasks cannot complete');
SELECT public.mutate_setup_workflow('sync', jsonb_build_object('tasks', current_setting('test.setup_tasks')::jsonb), current_setting('test.setup_id')::uuid);
SELECT is((SELECT completed_at::text FROM public.setup_workflow_tasks WHERE task_key = 'review'), current_setting('test.completed_at'), 'reactivation preserves audit timestamp');
SELECT is((SELECT metadata->>'note' FROM public.setup_workflow_tasks WHERE task_key = 'review'), 'keep', 'reactivation preserves metadata');
SELECT public.mutate_setup_workflow('task_status', '{"task_key":"pesos:sound","status":"blocked"}', current_setting('test.setup_id')::uuid);
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"complete"}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'incomplete_workflow: required work or blockers remain', 'optional blocker still prevents completion');
SELECT public.mutate_setup_workflow('task_status', '{"task_key":"pesos:sound","status":"skipped"}', current_setting('test.setup_id')::uuid);
SELECT lives_ok(
  $$SELECT public.mutate_setup_workflow('status', '{"status":"complete"}', current_setting('test.setup_id')::uuid)$$,
  'completed required and skipped optional tasks allow completion');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('sync', '{"tasks":[]}', current_setting('test.setup_id')::uuid)$$,
  '22023', 'invalid_transition: terminal workflow is immutable', 'terminal workflows cannot be edited');
SELECT lives_ok(
  $$SELECT public.mutate_setup_workflow('create', current_setting('test.setup_create')::jsonb)$$,
  'completed history permits a new active workflow for the same entity');

-- Rollback test: a malformed initial task must not leave a partial workflow.
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('create', '{"type":"job","entity_id":"af200000-0000-0000-0000-000000000002","tasks":[{}]}')$$,
  '22023', 'invalid_input: malformed or duplicate task definitions', 'invalid initial tasks fail atomically');
SELECT is((SELECT count(*)::integer FROM public.setup_workflows WHERE entity_id = 'af200000-0000-0000-0000-000000000002'), 0, 'failed creation leaves no workflow');

SELECT set_config('request.jwt.claim.sub', 'af100000-0000-0000-0000-000000000002', true);
SELECT is((SELECT count(*)::integer FROM public.setup_workflows), 0, 'technician cannot read workflow state');
SELECT is((SELECT count(*)::integer FROM public.setup_workflow_tasks), 0, 'technician cannot read setup tasks');
SELECT throws_ok(
  $$SELECT public.mutate_setup_workflow('state', '{"state":{}}', current_setting('test.setup_id')::uuid)$$,
  '42501', 'forbidden: setup workflows require management access', 'technician cannot mutate even with known workflow id');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
