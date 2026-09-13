CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(10);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'c1100000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'transport-generated@test.local', 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES (
  'c1100000-0000-0000-0000-000000000001'::uuid,
  'transport-generated@test.local', 'Generated', 'Transport', 'management', 'production'
)
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'c2100000-0000-0000-0000-000000000001'::uuid,
  'Generated Transport Fixture', now(), now() + interval '1 day', 'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'c1100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

CREATE TEMP TABLE generated_transport_ids(kind text primary key, request_id uuid);

INSERT INTO generated_transport_ids(kind, request_id)
SELECT 'tour', public.replace_transport_request_with_items(
  null,
  'c2100000-0000-0000-0000-000000000001'::uuid,
  'sound',
  'Initial tour demand',
  'requested',
  'c1100000-0000-0000-0000-000000000001'::uuid,
  '[{"transport_type":"trailer","leftover_space_meters":2}]'::jsonb
);

SELECT is(
  (SELECT source_type FROM public.transport_requests WHERE id = (SELECT request_id FROM generated_transport_ids WHERE kind = 'tour')),
  'tour',
  'tour generator owns a dedicated source request'
);

SELECT lives_ok(
  format(
    'select public.schedule_transport_request(%L::uuid, %L::date, %L::time, %L::date, %L::time)',
    (SELECT request_id FROM generated_transport_ids WHERE kind = 'tour'),
    '2026-09-22', '08:00', '2026-09-22', '20:00'
  ),
  'tour demand can enter execution'
);

SELECT lives_ok(
  format(
    'select public.replace_transport_request_with_items(%L::uuid, %L::uuid, %L, %L, %L, %L::uuid, %L::jsonb)',
    (SELECT request_id FROM generated_transport_ids WHERE kind = 'tour'),
    'c2100000-0000-0000-0000-000000000001',
    'sound',
    'Retry must not replace planned demand',
    'requested',
    'c1100000-0000-0000-0000-000000000001',
    '[{"transport_type":"4m","leftover_space_meters":0}]'
  ),
  'tour retry after planning is an idempotent no-op'
);

SELECT is(
  (SELECT transport_type::text FROM public.transport_request_items WHERE request_id = (SELECT request_id FROM generated_transport_ids WHERE kind = 'tour') LIMIT 1),
  'trailer',
  'tour retry does not rewrite planned vehicle demand'
);

SELECT is(
  (SELECT planning_status FROM public.transport_requests WHERE id = (SELECT request_id FROM generated_transport_ids WHERE kind = 'tour')),
  'planned',
  'tour retry leaves the execution lifecycle unchanged'
);

INSERT INTO generated_transport_ids(kind, request_id)
SELECT 'truck', public.tp_upsert_department_transport_request(
  'c2100000-0000-0000-0000-000000000001'::uuid,
  'lights',
  '9m',
  'Initial truck plan',
  null,
  1
);

SELECT is(
  (SELECT source_type FROM public.transport_requests WHERE id = (SELECT request_id FROM generated_transport_ids WHERE kind = 'truck')),
  'truck_planner',
  'truck planner owns a dedicated source request'
);

SELECT lives_ok(
  format(
    'select public.schedule_transport_request(%L::uuid, %L::date, %L::time, %L::date, %L::time)',
    (SELECT request_id FROM generated_transport_ids WHERE kind = 'truck'),
    '2026-09-23', '09:00', '2026-09-23', '21:00'
  ),
  'truck-planner demand can enter execution'
);

SELECT lives_ok(
  format(
    'select public.tp_upsert_department_transport_request(%L::uuid, %L, %L, %L, null, %L::numeric)',
    'c2100000-0000-0000-0000-000000000001',
    'lights',
    '4m',
    'Retry must not replace planned demand',
    '0'
  ),
  'truck-planner retry after planning is an idempotent no-op'
);

SELECT is(
  (SELECT transport_type::text FROM public.transport_request_items WHERE request_id = (SELECT request_id FROM generated_transport_ids WHERE kind = 'truck') LIMIT 1),
  '9m',
  'truck-planner retry does not rewrite planned vehicle demand'
);

SELECT is(
  (SELECT planning_status FROM public.transport_requests WHERE id = (SELECT request_id FROM generated_transport_ids WHERE kind = 'truck')),
  'planned',
  'truck-planner retry leaves the execution lifecycle unchanged'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.logistics_event_departments
WHERE event_id IN (
  SELECT id FROM public.logistics_events
  WHERE transport_request_id IN (
    SELECT id FROM public.transport_requests
    WHERE job_id = 'c2100000-0000-0000-0000-000000000001'::uuid
  )
);
DELETE FROM public.logistics_events
WHERE transport_request_id IN (
  SELECT id FROM public.transport_requests
  WHERE job_id = 'c2100000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.transport_request_items
WHERE request_id IN (
  SELECT id FROM public.transport_requests
  WHERE job_id = 'c2100000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.transport_requests
WHERE job_id = 'c2100000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'c2100000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id = 'c1100000-0000-0000-0000-000000000001'::uuid;
DELETE FROM auth.users WHERE id = 'c1100000-0000-0000-0000-000000000001'::uuid;

SELECT * FROM finish();
