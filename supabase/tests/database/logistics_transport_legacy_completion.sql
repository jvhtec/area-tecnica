BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(51);

SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT ('c1300000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'transport-legacy-' || n || '@test.local',
  'test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'
FROM generate_series(1, 4) n;
INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
SELECT ('c1300000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'transport-legacy-' || n || '@test.local', 'Legacy', 'Actor', actor_role, department
FROM (VALUES (1, 'admin', 'sound'), (2, 'management', 'logistics'),
  (3, 'management', 'sound'), (4, 'house_tech', 'sound')) actors(n, actor_role, department)
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES ('c2300000-0000-0000-0000-000000000001', 'Legacy transport', now(), now() + interval '1 day', 'single');
INSERT INTO public.transport_requests (id, job_id, department, created_by, note, created_at)
SELECT ('c3300000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'c2300000-0000-0000-0000-000000000001', 'sound',
       'c1300000-0000-0000-0000-000000000001', 'Original demand', '2026-09-01'
FROM generate_series(1, 10) n;
-- Simulate the frozen migration snapshot as the database owner, never as a client.
INSERT INTO public.transport_request_legacy_candidates (request_id)
SELECT id FROM public.transport_requests
WHERE job_id = 'c2300000-0000-0000-0000-000000000001'
  AND id <> 'c3300000-0000-0000-0000-000000000006';
INSERT INTO public.logistics_events (id, job_id, transport_request_id, event_type, transport_type, event_date, event_time, notes)
VALUES
  ('c5300000-0000-0000-0000-000000000001', 'c2300000-0000-0000-0000-000000000001', 'c3300000-0000-0000-0000-000000000002', 'load', 'trailer', '2026-09-01', '08:00', 'Partial historical record');
INSERT INTO public.logistics_event_departments (event_id, department)
VALUES ('c5300000-0000-0000-0000-000000000001', 'sound');
SELECT set_config('request.jwt.claim.role', '', true);
UPDATE public.transport_requests SET planning_status = 'cancelled' WHERE id = 'c3300000-0000-0000-0000-000000000004';
UPDATE public.transport_requests SET planning_status = 'completed' WHERE id = 'c3300000-0000-0000-0000-000000000005';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000001', true);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.transport_request_legacy_candidates'::regclass), 'candidate snapshot has RLS');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.transport_request_legacy_completions'::regclass), 'audit has RLS');
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', 'Historical closure') $$, '42501', NULL, 'anon cannot call legacy closure');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', 'Historical closure') $$, '42501', NULL, 'logistics managers cannot use admin legacy closure');
SELECT is((SELECT count(*)::integer FROM public.transport_request_legacy_candidates), 0, 'management cannot read the protected candidate table');
SELECT is((SELECT count(*)::integer FROM public.transport_request_legacy_completions), 0, 'management cannot read the audit');
SELECT throws_ok($$ SELECT public.set_transport_request_stage('c3300000-0000-0000-0000-000000000001', 'completed') $$, '22023', NULL, 'normal management completion still requires a plan on eligible requests');
SELECT lives_ok($$ SELECT public.schedule_transport_request('c3300000-0000-0000-0000-000000000007', '2026-09-24', '08:00', '2026-09-24', '18:00') $$, 'logistics management can still schedule normally');
SELECT lives_ok($$ SELECT public.set_transport_request_stage('c3300000-0000-0000-0000-000000000007', 'completed') $$, 'logistics management can still complete a full normal plan');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', 'Historical closure') $$, '42501', NULL, 'other managers cannot use admin legacy closure');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000004', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', 'Historical closure') $$, '42501', NULL, 'house technicians cannot use admin legacy closure');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', 'Missing identity') $$, '42501', NULL, 'an authenticated database role still requires a user identity');
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000001', true);
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', '  ') $$, '22023', NULL, 'admin must supply a reason');
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', E' \t\n ') $$, '22023', NULL, 'whitespace-only reasons are rejected by the server');
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', NULL) $$, '22023', NULL, 'null reasons are rejected');
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', repeat('x', 1001)) $$, '22023', NULL, 'oversized reasons are rejected');
SELECT throws_ok($$ UPDATE public.transport_requests SET planning_status = 'completed' WHERE id = 'c3300000-0000-0000-0000-000000000008' $$, '22023', NULL, 'admin direct writes do not get the legacy exception');
SELECT set_config('app.legacy_transport_completion', 'true', true);
SELECT throws_ok($$ UPDATE public.transport_requests SET planning_status = 'completed' WHERE id = 'c3300000-0000-0000-0000-000000000008' $$, '22023', NULL, 'a client-controlled setting cannot spoof legacy authorization');
SELECT throws_ok($$ INSERT INTO public.transport_request_legacy_candidates (request_id) VALUES ('c3300000-0000-0000-0000-000000000006') $$, '42501', NULL, 'even admins cannot add eligibility directly');
SELECT throws_ok($$ UPDATE public.transport_request_legacy_candidates SET captured_at = now() $$, '42501', NULL, 'candidate snapshot is immutable to clients');
SELECT throws_ok($$ DELETE FROM public.transport_request_legacy_candidates $$, '42501', NULL, 'clients cannot delete the candidate snapshot');
SELECT throws_ok($$ INSERT INTO public.transport_request_legacy_completions (request_id, completed_by, completed_at, reason, completion_xid) VALUES ('c3300000-0000-0000-0000-000000000008', auth.uid(), now(), 'Spoofed', pg_current_xact_id()) $$, '42501', NULL, 'clients cannot forge the protected transaction audit');
UPDATE public.transport_requests SET created_at = '1990-01-01' WHERE id = 'c3300000-0000-0000-0000-000000000006';
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000006', 'Backdated new request') $$, '22023', NULL, 'a noncandidate is denied even with an old created_at');
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000004', 'Cancelled') $$, '22023', NULL, 'cancelled legacy requests cannot complete');
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000005', 'Already completed normally') $$, '22023', NULL, 'normal completed rows cannot be relabeled as legacy closures');
SELECT is((SELECT count(*)::integer FROM public.transport_request_legacy_completions), 0, 'rejected actions leave no audit');
SELECT is((SELECT (request->>'legacy_completion_eligible')::boolean FROM jsonb_array_elements(public.list_transport_requests('c2300000-0000-0000-0000-000000000001')) request WHERE request->>'id' = 'c3300000-0000-0000-0000-000000000001'), true, 'read model exposes active frozen eligibility');

SELECT lives_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', '  Historical request already served  ') $$, 'admin may complete an eligible request without events');
SELECT is((SELECT planning_status || '/' || status FROM public.transport_requests WHERE id = 'c3300000-0000-0000-0000-000000000001'), 'completed/fulfilled', 'legacy closure updates both lifecycle projections');
SELECT is((SELECT count(*)::integer FROM public.logistics_events WHERE transport_request_id = 'c3300000-0000-0000-0000-000000000001'), 0, 'legacy closure invents no execution events');
SELECT ok((SELECT completed_by = auth.uid() AND completed_at IS NOT NULL AND reason = 'Historical request already served' FROM public.transport_request_legacy_completions WHERE request_id = 'c3300000-0000-0000-0000-000000000001'), 'audit records the authenticated actor, time and trimmed reason');
SELECT lives_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000001', 'Retry with different reason') $$, 'repeating a successful closure is idempotent');
SELECT is((SELECT reason FROM public.transport_request_legacy_completions WHERE request_id = 'c3300000-0000-0000-0000-000000000001'), 'Historical request already served', 'retries preserve the original audit');
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000002', true);
SELECT is((SELECT count(*)::integer FROM public.transport_request_legacy_completions), 0, 'management cannot read audit rows after a successful admin closure');
SELECT set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000001', true);
SELECT throws_ok($$ UPDATE public.transport_request_legacy_completions SET reason = 'Overwritten' $$, '42501', NULL, 'admins cannot overwrite the audit directly');
SELECT throws_ok($$ DELETE FROM public.transport_request_legacy_completions $$, '42501', NULL, 'admins cannot delete the audit directly');
SELECT lives_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000002', 'Partial historical record confirmed externally') $$, 'legacy closure accepts partial historical execution');
SELECT is((SELECT notes FROM public.logistics_events WHERE id = 'c5300000-0000-0000-0000-000000000001'), 'Partial historical record', 'partial historical event survives unchanged');
SELECT is((SELECT count(*)::integer FROM public.logistics_event_departments WHERE event_id = 'c5300000-0000-0000-0000-000000000001'), 1, 'historical event department survives');
SELECT public.schedule_transport_request('c3300000-0000-0000-0000-000000000003', '2026-09-24', '08:00', '2026-09-24', '18:00', NULL, 'AUDIT-123', 'Bay A', 'Preserved full plan');
CREATE TEMP TABLE legacy_events_before AS SELECT to_jsonb(le) AS payload FROM public.logistics_events le WHERE transport_request_id = 'c3300000-0000-0000-0000-000000000003';
SELECT lives_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000003', 'Full historical execution') $$, 'legacy closure accepts a full historical plan');
SELECT results_eq($$ SELECT to_jsonb(le) FROM public.logistics_events le WHERE transport_request_id = 'c3300000-0000-0000-0000-000000000003' ORDER BY id $$, $$ SELECT payload FROM legacy_events_before ORDER BY (payload->>'id')::uuid $$, 'all full-plan event fields survive unchanged');
SELECT throws_ok($$ UPDATE public.transport_requests SET note = 'Changed demand' WHERE id = 'c3300000-0000-0000-0000-000000000001' $$, '22023', NULL, 'legacy-completed demand remains immutable');
SELECT throws_ok($$ UPDATE public.transport_requests SET planning_status = 'reviewing' WHERE id = 'c3300000-0000-0000-0000-000000000001' $$, '22023', NULL, 'legacy-completed requests remain terminal');
SELECT is((SELECT (request->>'legacy_completion_eligible')::boolean FROM jsonb_array_elements(public.list_transport_requests('c2300000-0000-0000-0000-000000000001', NULL, true)) request WHERE request->>'id' = 'c3300000-0000-0000-0000-000000000001'), false, 'completed requests no longer advertise eligibility');
SELECT throws_ok($$ SELECT public.set_transport_request_stage('c3300000-0000-0000-0000-000000000009', 'completed') $$, '22023', NULL, 'admin normal completion still requires a plan after another legacy RPC');

SELECT lives_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000010', 'Keep historical audit after deletion') $$, 'another eligible request can complete independently');
DELETE FROM public.transport_requests WHERE id = 'c3300000-0000-0000-0000-000000000010';
SELECT is((SELECT count(*)::integer FROM public.transport_request_legacy_completions WHERE request_id = 'c3300000-0000-0000-0000-000000000010'), 1, 'request deletion retains its completion audit');
SELECT is((SELECT count(*)::integer FROM public.transport_request_legacy_candidates WHERE request_id = 'c3300000-0000-0000-0000-000000000010'), 0, 'request deletion removes candidate eligibility');
INSERT INTO public.transport_requests (id, job_id, department)
VALUES ('c3300000-0000-0000-0000-000000000010', 'c2300000-0000-0000-0000-000000000001', 'sound');
SELECT throws_ok($$ SELECT public.complete_legacy_transport_request('c3300000-0000-0000-0000-000000000010', 'Reused ID') $$, '22023', NULL, 'reusing a deleted ID cannot reuse its eligibility or audit');
RESET ROLE;
INSERT INTO public.transport_request_legacy_completions (request_id, completed_by, completed_at, reason, completion_xid)
VALUES ('c3300000-0000-0000-0000-000000000008', 'c1300000-0000-0000-0000-000000000001', now(), 'Prior transaction audit', '1'::xid8);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ UPDATE public.transport_requests SET planning_status = 'completed' WHERE id = 'c3300000-0000-0000-0000-000000000008' $$, '22023', NULL, 'an audit from a different transaction cannot authorize direct completion');
SELECT is((SELECT planning_status FROM public.transport_requests WHERE id = 'c3300000-0000-0000-0000-000000000008'), 'requested', 'rejected stale-audit replay leaves the request active');

SELECT * FROM finish();
ROLLBACK;
