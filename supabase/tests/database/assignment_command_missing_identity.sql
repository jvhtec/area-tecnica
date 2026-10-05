\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();

-- No entities are required: authorization must happen before validation,
-- lookup, claims, ledger writes or mutations. This identity has no profile.
CREATE TEMP TABLE assignment_boundary_calls (name text, statement text);
INSERT INTO assignment_boundary_calls VALUES
  ('single state', 'SELECT public.get_assignment_command_state(NULL,NULL)'),
  ('job state', 'SELECT public.get_job_assignment_command_states(NULL)'),
  ('direct assignment', 'SELECT public.apply_direct_assignment(NULL,NULL,NULL,NULL,NULL,NULL)'),
  ('whole removal', 'SELECT public.remove_direct_assignment(NULL,NULL,NULL)'),
  ('date removal', 'SELECT public.remove_assignment_date(NULL,NULL,NULL,NULL)'),
  ('role change', 'SELECT public.change_assignment_role(NULL,NULL,NULL,NULL,NULL)'),
  ('status change', 'SELECT public.set_assignment_status(NULL,NULL,NULL,NULL)'),
  ('effect claim', 'SELECT public.claim_assignment_side_effects(NULL)'),
  ('effect report', 'SELECT public.record_assignment_side_effects(NULL,NULL,NULL)'),
  ('backlog', 'SELECT * FROM public.get_assignment_side_effect_backlog()'),
  ('metrics', 'SELECT * FROM public.get_assignment_command_metrics()'),
  ('consistency', 'SELECT * FROM public.get_assignment_consistency_issues()'),
  ('legacy removal', 'SELECT * FROM public.remove_assignment_with_timesheets(NULL,NULL)'),
  ('legacy day toggle', 'SELECT public.toggle_timesheet_day(NULL,NULL,NULL,false)');
GRANT SELECT ON assignment_boundary_calls TO authenticated;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'ad040000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"ad040000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(public.current_user_role() IS NULL, 'missing profile resolves to NULL');
SELECT throws_ok(statement, '42501', 'permission denied', name || ' rejects missing profile')
FROM assignment_boundary_calls;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(auth.uid() IS NULL, 'JWT has no interactive identity');
SELECT throws_ok(statement, '42501', 'permission denied', name || ' rejects missing identity')
FROM assignment_boundary_calls;
RESET ROLE;

SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(statement, '42501', 'permission denied', name || ' rejects missing JWT context')
FROM assignment_boundary_calls;
RESET ROLE;

-- Service callers deliberately retain access without an interactive profile.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT lives_ok('SELECT * FROM public.get_assignment_side_effect_backlog()', 'service can read backlog');
SELECT lives_ok('SELECT * FROM public.get_assignment_command_metrics()', 'service can read metrics');
SELECT lives_ok('SELECT * FROM public.get_assignment_consistency_issues()', 'service can read diagnostics');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
