BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(16);

SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'c1200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'transport-boundaries@test.local', 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'
);
INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES (
  'c1200000-0000-0000-0000-000000000001', 'transport-boundaries@test.local',
  'Transport', 'Boundaries', 'management', 'logistics'
)
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES ('c2200000-0000-0000-0000-000000000001', 'Transport Boundaries', now(), now() + interval '1 day', 'single');

INSERT INTO public.transport_requests (id, job_id, department, created_by, note)
SELECT id::uuid, 'c2200000-0000-0000-0000-000000000001', 'sound',
       'c1200000-0000-0000-0000-000000000001', 'Original demand note'
FROM (VALUES
  ('c3200000-0000-0000-0000-000000000001'),
  ('c3200000-0000-0000-0000-000000000002'),
  ('c3200000-0000-0000-0000-000000000003')
) AS requests(id);
INSERT INTO public.transport_request_items (id, request_id, transport_type)
VALUES
  ('c4200000-0000-0000-0000-000000000001', 'c3200000-0000-0000-0000-000000000001', 'trailer'),
  ('c4200000-0000-0000-0000-000000000002', 'c3200000-0000-0000-0000-000000000001', '9m'),
  ('c4200000-0000-0000-0000-000000000003', 'c3200000-0000-0000-0000-000000000002', '4m');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'c1200000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ INSERT INTO public.transport_requests (job_id, department, created_by)
     VALUES ('c2200000-0000-0000-0000-000000000001', 'sound', 'c1200000-0000-0000-0000-000000000001') $$,
  'management may insert ordinary requested demand directly'
);

SELECT throws_ok(
  format('INSERT INTO public.transport_requests (job_id, department, planning_status) VALUES (%L::uuid, %L, %L)',
    'c2200000-0000-0000-0000-000000000001', 'sound', stage),
  '22023', NULL,
  format('direct inserts cannot skip requested and start in %s', stage)
)
FROM (VALUES ('planned'), ('confirmed'), ('completed'), ('cancelled')) AS stages(stage);

SELECT throws_ok(
  format('INSERT INTO public.transport_requests (job_id, department, status) VALUES (%L::uuid, %L, %L)',
    'c2200000-0000-0000-0000-000000000001', 'sound', legacy_status),
  '22023', NULL,
  format('direct inserts cannot contradict requested planning status with legacy status %s', legacy_status)
)
FROM (VALUES ('fulfilled'), ('cancelled')) AS statuses(legacy_status);

SELECT lives_ok(
  $$ SELECT public.schedule_transport_request(
       'c3200000-0000-0000-0000-000000000001',
       '2026-09-24', '08:00', '2026-09-24', '18:00',
       NULL, NULL, NULL, 'Execution note from the planner') $$,
  'the scheduling RPC remains the supported way to enter planned'
);

SELECT is(
  (SELECT count(*)::integer
   FROM jsonb_array_elements(public.list_transport_requests('c2200000-0000-0000-0000-000000000001')) AS request,
        jsonb_array_elements(request->'events') AS event
   WHERE request->>'id' = 'c3200000-0000-0000-0000-000000000001'
     AND event->>'notes' = 'Execution note from the planner'),
  4,
  'the inbox exposes the saved execution note on every scheduled vehicle movement'
);

SELECT throws_ok(
  $$ UPDATE public.transport_request_items SET request_id = 'c3200000-0000-0000-0000-000000000002'
     WHERE id = 'c4200000-0000-0000-0000-000000000001' $$,
  '22023', NULL,
  'moving an item away from a planned request cannot bypass frozen demand'
);
SELECT is(
  (SELECT count(*)::integer FROM public.transport_request_items
   WHERE request_id = 'c3200000-0000-0000-0000-000000000001'),
  2,
  'a rejected item move preserves all planned vehicles'
);
SELECT throws_ok(
  $$ UPDATE public.transport_request_items SET request_id = 'c3200000-0000-0000-0000-000000000001'
     WHERE id = 'c4200000-0000-0000-0000-000000000003' $$,
  '22023', NULL,
  'moving a draft item into a planned request remains forbidden'
);
SELECT lives_ok(
  $$ UPDATE public.transport_request_items SET request_id = 'c3200000-0000-0000-0000-000000000003'
     WHERE id = 'c4200000-0000-0000-0000-000000000003' $$,
  'item moves between editable requests remain permitted'
);
SELECT lives_ok(
  $$ SELECT public.set_transport_request_stage('c3200000-0000-0000-0000-000000000001', 'completed') $$,
  'the unchanged two-vehicle plan can still complete'
);
SELECT throws_ok(
  $$ UPDATE public.transport_request_items SET request_id = 'c3200000-0000-0000-0000-000000000002'
     WHERE id = 'c4200000-0000-0000-0000-000000000001' $$,
  '22023', NULL,
  'completed request items cannot be moved into an editable request'
);
SELECT throws_ok(
  $$ UPDATE public.transport_request_items SET transport_type = '4m'
     WHERE id = 'c4200000-0000-0000-0000-000000000002' $$,
  '22023', NULL,
  'completed request items also remain immutable in place'
);

SELECT * FROM finish();
ROLLBACK;
