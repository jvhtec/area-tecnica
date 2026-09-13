CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Seed as the service role. Inserting an auth user fires handle_new_user, which
-- auto-provisions a public.profiles row, so the upsert below takes the UPDATE path and
-- trips enforce_profile_privilege_changes. That guard (like the transport write guard)
-- exempts auth.role() = 'service_role'.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- profiles.id is a foreign key onto auth.users, so the identities must exist first.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('b1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'transport-mgmt@test.local', 'test', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'transport-house@test.local', 'test', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'transport-tech@test.local', 'test', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'transport-mgmt@test.local',  'Trans', 'Management', 'management', 'logistics'),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 'transport-house@test.local', 'Trans', 'HouseTech',  'house_tech', 'logistics'),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 'transport-tech@test.local',  'Trans', 'Technician', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'Transport Authorization Fixture',
  now(),
  now() + interval '1 day',
  'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

INSERT INTO public.transport_requests (
  id, job_id, department, created_by, status, planning_status,
  movement_type, priority, source_type, is_hoja_relevant
) VALUES (
  'b3000000-0000-0000-0000-000000000001'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'sound',
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'requested',
  'requested',
  'transfer',
  'normal',
  'manual',
  true
)
ON CONFLICT (id) DO UPDATE SET planning_status = 'requested', status = 'requested';

-- ---------------------------------------------------------------------------
-- RLS expresses the role model on its own, independently of the write trigger.
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'transport_requests'),
  4,
  'transport_requests carries exactly one policy per CRUD operation'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('logistics_events', 'logistics_event_departments')
      AND cmd <> 'SELECT'
      AND (qual ILIKE '%house_tech%' OR with_check ILIKE '%house_tech%')
  ),
  'no logistics event write policy grants house_tech'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'transport_requests', 'transport_request_items',
        'logistics_events', 'logistics_event_departments'
      )
      AND 'anon' = ANY (roles)
  ),
  'the anon role holds no policy on any transport or logistics table'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transport_requests'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%get_user_job_ids%'
  ),
  'transport request inserts are no longer granted by job assignment'
);

-- ---------------------------------------------------------------------------
-- Management holds full transport authority.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.save_transport_request(
       NULL,
       'b2000000-0000-0000-0000-000000000001'::uuid,
       'production',
       'Management created request',
       NULL, NULL, 'Almacen', 'Recinto', 'transfer', 'normal', true, 'manual', NULL,
       '[{"transport_type":"trailer","leftover_space_meters":2.5}]'::jsonb
     ) $$,
  'management may raise a transport request for any active department'
);

SELECT throws_ok(
  $$ SELECT public.save_transport_request(
       NULL,
       'b2000000-0000-0000-0000-000000000001'::uuid,
       'sound',
       repeat('x', 2001),
       NULL, NULL, NULL, NULL, 'transfer', 'normal', true, 'manual', NULL,
       '[{"transport_type":"trailer","leftover_space_meters":null}]'::jsonb
     ) $$,
  '22001',
  NULL,
  'oversized request text is rejected at the RPC boundary'
);

SELECT throws_ok(
  $$ SELECT public.save_transport_request(
       NULL,
       'b2000000-0000-0000-0000-000000000001'::uuid,
       'sound',
       NULL, NULL, NULL, NULL, NULL, 'transfer', 'normal', true, 'manual', NULL,
       '[{"transport_type":"helicopter","leftover_space_meters":null}]'::jsonb
     ) $$,
  '22023',
  NULL,
  'an unknown vehicle type is rejected'
);

-- Lifecycle is a real state machine, not a free-for-all.
SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'b3000000-0000-0000-0000-000000000001'::uuid, 'completed') $$,
  '22023',
  NULL,
  'a request cannot jump from requested straight to completed'
);

SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'b3000000-0000-0000-0000-000000000001'::uuid, 'confirmed') $$,
  '22023',
  NULL,
  'a request cannot be confirmed before it is planned'
);

SELECT lives_ok(
  $$ SELECT public.set_transport_request_stage(
       'b3000000-0000-0000-0000-000000000001'::uuid, 'reviewing') $$,
  'requested -> reviewing is a legal transition'
);

SELECT throws_ok(
  $$ SELECT public.schedule_transport_request(
       'b3000000-0000-0000-0000-000000000001'::uuid,
       '2026-09-20'::date, '10:00'::time,
       '2026-09-19'::date, '09:00'::time) $$,
  '22023',
  NULL,
  'an unload before its own load is rejected'
);

SELECT lives_ok(
  $$ SELECT public.schedule_transport_request(
       'b3000000-0000-0000-0000-000000000001'::uuid,
       '2026-09-20'::date, '10:00'::time,
       '2026-09-21'::date, '09:00'::time) $$,
  'management may plan a transport request'
);

SELECT is(
  (SELECT planning_status FROM public.transport_requests
   WHERE id = 'b3000000-0000-0000-0000-000000000001'::uuid),
  'planned',
  'planning without a carrier leaves the request planned rather than confirmed'
);

SELECT lives_ok(
  $$ SELECT public.set_transport_request_stage(
       'b3000000-0000-0000-0000-000000000001'::uuid, 'completed') $$,
  'a planned request may be completed'
);

SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'b3000000-0000-0000-0000-000000000001'::uuid, 'requested') $$,
  '22023',
  NULL,
  'a completed request cannot be reopened'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- House techs read the whole workspace and write none of it.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.list_transport_requests(NULL, NULL, true) $$,
  'house techs may read the global transport request inbox'
);

SELECT ok(
  jsonb_array_length(public.list_transport_requests(NULL, NULL, true)) > 0,
  'the house-tech inbox is not silently empty'
);

SELECT throws_ok(
  $$ SELECT public.save_transport_request(
       NULL,
       'b2000000-0000-0000-0000-000000000001'::uuid,
       'sound',
       'House tech attempt',
       NULL, NULL, NULL, NULL, 'transfer', 'normal', true, 'manual', NULL,
       '[{"transport_type":"trailer","leftover_space_meters":null}]'::jsonb
     ) $$,
  '42501',
  NULL,
  'house techs cannot create transport requests through the RPC'
);

SELECT throws_ok(
  $$ INSERT INTO public.transport_requests (job_id, department, status, planning_status)
     VALUES ('b2000000-0000-0000-0000-000000000001'::uuid, 'sound', 'requested', 'requested') $$,
  '42501',
  NULL,
  'house techs cannot insert transport requests directly'
);

SELECT throws_ok(
  $$ INSERT INTO public.logistics_events (event_type, event_date, event_time, transport_type, job_id)
     VALUES ('load', '2026-09-20'::date, '10:00'::time, 'trailer', 'b2000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  NULL,
  'house techs cannot insert logistics events directly'
);

SELECT throws_ok(
  $$ SELECT public.set_transport_request_stage(
       'b3000000-0000-0000-0000-000000000001'::uuid, 'cancelled') $$,
  '42501',
  NULL,
  'house techs cannot move a request through the lifecycle'
);

RESET ROLE;

-- The whole point of aligning RLS with the role model: the write trigger must not be the
-- only thing standing between a house tech and the transport tables. Drop the trigger out
-- of the way and the policies alone must still refuse the write.
ALTER TABLE public.transport_requests DISABLE TRIGGER enforce_transport_management_write;
ALTER TABLE public.logistics_events DISABLE TRIGGER enforce_logistics_event_management_write;

SET ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO public.transport_requests (job_id, department, status, planning_status)
     VALUES ('b2000000-0000-0000-0000-000000000001'::uuid, 'sound', 'requested', 'requested') $$,
  '42501',
  NULL,
  'RLS alone still blocks a house-tech request insert when the write trigger is disabled'
);

SELECT throws_ok(
  $$ INSERT INTO public.logistics_events (event_type, event_date, event_time, transport_type, job_id)
     VALUES ('load', '2026-09-20'::date, '10:00'::time, 'trailer', 'b2000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  NULL,
  'RLS alone still blocks a house-tech logistics event insert when the write trigger is disabled'
);

RESET ROLE;

ALTER TABLE public.transport_requests ENABLE TRIGGER enforce_transport_management_write;
ALTER TABLE public.logistics_events ENABLE TRIGGER enforce_logistics_event_management_write;

-- ---------------------------------------------------------------------------
-- Technicians have no logistics operations access at all.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.list_transport_requests(NULL, NULL, false) $$,
  '42501',
  NULL,
  'technicians cannot read the global transport inbox'
);

SELECT throws_ok(
  $$ INSERT INTO public.transport_requests (job_id, department, status, planning_status)
     VALUES ('b2000000-0000-0000-0000-000000000001'::uuid, 'sound', 'requested', 'requested') $$,
  '42501',
  NULL,
  'technicians cannot insert transport requests directly'
);

SELECT is(
  (SELECT count(*)::integer FROM public.logistics_events
   WHERE job_id = 'b2000000-0000-0000-0000-000000000001'::uuid),
  0,
  'technicians cannot read logistics events'
);

RESET ROLE;

-- Drop the simulated identity before tearing down: RESET ROLE restores the database role
-- but leaves the JWT claims set, and the hardened write guard reads those claims, so the
-- cleanup would otherwise be refused as the technician who ran the last assertion.
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- pg_prove runs every test file against one database, so clean up after ourselves.
DELETE FROM public.logistics_event_departments WHERE event_id IN (
  SELECT id FROM public.logistics_events WHERE job_id = 'b2000000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.logistics_events WHERE job_id = 'b2000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.transport_request_items WHERE request_id IN (
  SELECT id FROM public.transport_requests WHERE job_id = 'b2000000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.transport_requests WHERE job_id = 'b2000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'b2000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id IN (
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid
);

SELECT * FROM finish();
