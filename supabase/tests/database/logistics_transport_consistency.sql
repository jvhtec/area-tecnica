CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(14);

-- Seed/teardown as the trusted backend because auth.users provisioning also writes profiles.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'c1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'transport-consistency@test.local', 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES (
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'transport-consistency@test.local', 'Transport', 'Consistency', 'management', 'logistics'
)
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'c2000000-0000-0000-0000-000000000001'::uuid,
  'Transport Consistency Fixture',
  now(), now() + interval '1 day', 'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

INSERT INTO public.transport_requests (
  id, job_id, department, created_by, description, status, planning_status,
  movement_type, priority, source_type, is_hoja_relevant
) VALUES (
  'c3000000-0000-0000-0000-000000000001'::uuid,
  'c2000000-0000-0000-0000-000000000001'::uuid,
  'sound',
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'Consistency fixture',
  'requested', 'requested', 'transfer', 'normal', 'manual', true
)
ON CONFLICT (id) DO UPDATE
SET description = 'Consistency fixture',
    status = 'requested',
    planning_status = 'requested',
    source_type = 'manual',
    source_ref = null;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.set_transport_request_stage(
       'c3000000-0000-0000-0000-000000000001'::uuid, 'reviewing') $$,
  'requested -> reviewing remains a legal demand transition'
);

SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'c3000000-0000-0000-0000-000000000001'::uuid, 'planned') $$,
  '22023',
  NULL,
  'a request cannot be labelled planned without linked execution events'
);

SELECT lives_ok(
  $$ SELECT public.schedule_transport_request(
       'c3000000-0000-0000-0000-000000000001'::uuid,
       '2026-09-20'::date, '10:00'::time,
       '2026-09-20'::date, '18:00'::time) $$,
  'the scheduling command creates the execution plan atomically'
);

SELECT is(
  (SELECT planning_status FROM public.transport_requests
   WHERE id = 'c3000000-0000-0000-0000-000000000001'::uuid),
  'planned',
  'scheduling without confirmation details leaves the request planned'
);

SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'c3000000-0000-0000-0000-000000000001'::uuid, 'confirmed') $$,
  '22023',
  NULL,
  'a plan cannot be marked confirmed without a carrier or vehicle identifier'
);

SELECT throws_ok(
  $$ SELECT public.save_transport_request(
       'c3000000-0000-0000-0000-000000000001'::uuid,
       'c2000000-0000-0000-0000-000000000001'::uuid,
       'sound',
       'Consistency fixture',
       NULL, NULL, NULL, NULL, 'transfer', 'normal', true, 'manual', NULL,
       '[{"transport_type":"trailer","leftover_space_meters":null}]'::jsonb
     ) $$,
  '22023',
  NULL,
  'vehicle demand is immutable once execution has been planned'
);

-- A linked plan must stay complete. Calendar-level mistakes must not be able to terminalise
-- a request while one half of its required load/unload pair is missing.
DELETE FROM public.logistics_events
WHERE id = (
  SELECT id FROM public.logistics_events
  WHERE transport_request_id = 'c3000000-0000-0000-0000-000000000001'::uuid
    AND event_type = 'unload'
  LIMIT 1
);

SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'c3000000-0000-0000-0000-000000000001'::uuid, 'completed') $$,
  '22023',
  NULL,
  'an incomplete execution plan cannot be completed'
);

SELECT lives_ok(
  $$ SELECT public.set_transport_request_stage(
       'c3000000-0000-0000-0000-000000000001'::uuid, 'reviewing') $$,
  'a plan may return to review explicitly'
);

SELECT is(
  (SELECT count(*)::integer FROM public.logistics_events
   WHERE transport_request_id = 'c3000000-0000-0000-0000-000000000001'::uuid),
  0,
  'returning to review removes the stale execution events'
);

SELECT lives_ok(
  $$ SELECT public.schedule_transport_request(
       'c3000000-0000-0000-0000-000000000001'::uuid,
       '2026-09-21'::date, '09:00'::time,
       '2026-09-21'::date, '17:00'::time) $$,
  'a reviewed request can be planned again'
);

SELECT throws_ok(
  $$ UPDATE public.transport_requests
     SET subrental_id = 'c4000000-0000-0000-0000-000000000001'::uuid
     WHERE id = 'c3000000-0000-0000-0000-000000000001'::uuid $$,
  '22023',
  NULL,
  'source normalization cannot bypass planned-demand immutability'
);

SELECT lives_ok(
  $$ UPDATE public.transport_requests
     SET status = 'cancelled', updated_at = now()
     WHERE id = 'c3000000-0000-0000-0000-000000000001'::uuid $$,
  'direct compatible cancellation still obeys the lifecycle trigger'
);

SELECT is(
  (SELECT count(*)::integer FROM public.logistics_events
   WHERE transport_request_id = 'c3000000-0000-0000-0000-000000000001'::uuid),
  0,
  'direct cancellation removes its load/unload events from the calendar'
);

SELECT is(
  (SELECT planning_status FROM public.transport_requests
   WHERE id = 'c3000000-0000-0000-0000-000000000001'::uuid),
  'cancelled',
  'the request reaches the cancelled terminal state after execution cleanup'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.logistics_event_departments WHERE event_id IN (
  SELECT id FROM public.logistics_events
  WHERE transport_request_id = 'c3000000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.logistics_events
WHERE transport_request_id = 'c3000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.transport_request_items
WHERE request_id = 'c3000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.transport_requests
WHERE id = 'c3000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs
WHERE id = 'c2000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles
WHERE id = 'c1000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM auth.users
WHERE id = 'c1000000-0000-0000-0000-000000000001'::uuid;

SELECT * FROM finish();