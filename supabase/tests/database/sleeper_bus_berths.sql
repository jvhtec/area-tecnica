CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(11);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
SELECT ok(
  'montoya' = ANY (enum_range(NULL::public.transport_provider_enum)::text[]),
  'Montoya can be recorded as the company a transport is hired from'
);

SELECT ok(
  (SELECT pg_get_constraintdef(oid) LIKE '%montoya%' AND pg_get_constraintdef(oid) LIKE '%crespo%'
          AND pg_get_constraintdef(oid) LIKE '%recogida_cliente%'
   FROM pg_constraint WHERE conname = 'hoja_de_ruta_transport_company_check'),
  'Hoja de Ruta transport rows accept every company the form offers, Montoya included'
);

-- ---------------------------------------------------------------------------
-- Fixtures: a manager, a job with three technicians (one declined) and a bus.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  u.id, '00000000-0000-0000-0000-000000000000'::uuid, u.email, 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('bb100000-0000-0000-0000-000000000001'::uuid, 'berths-manager@test.local'),
  ('bb100000-0000-0000-0000-000000000002'::uuid, 'berths-tech-a@test.local'),
  ('bb100000-0000-0000-0000-000000000003'::uuid, 'berths-tech-b@test.local'),
  ('bb100000-0000-0000-0000-000000000004'::uuid, 'berths-tech-c@test.local')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('bb100000-0000-0000-0000-000000000001'::uuid, 'berths-manager@test.local', 'Berth', 'Manager', 'management', 'logistics'),
  ('bb100000-0000-0000-0000-000000000002'::uuid, 'berths-tech-a@test.local', 'Tech', 'A', 'technician', 'sound'),
  ('bb100000-0000-0000-0000-000000000003'::uuid, 'berths-tech-b@test.local', 'Tech', 'B', 'technician', 'lights'),
  ('bb100000-0000-0000-0000-000000000004'::uuid, 'berths-tech-c@test.local', 'Tech', 'C', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'bb200000-0000-0000-0000-000000000001'::uuid,
  'Sleeper Bus Berths Fixture',
  '2031-05-10 08:00:00+02'::timestamptz,
  '2031-05-10 23:00:00+02'::timestamptz,
  'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

INSERT INTO public.job_assignments (id, job_id, technician_id, status, sound_role, assignment_source)
VALUES
  ('bb300000-0000-0000-0000-000000000001'::uuid, 'bb200000-0000-0000-0000-000000000001'::uuid,
   'bb100000-0000-0000-0000-000000000002'::uuid, 'confirmed', 'FOH-A', 'direct'),
  ('bb300000-0000-0000-0000-000000000002'::uuid, 'bb200000-0000-0000-0000-000000000001'::uuid,
   'bb100000-0000-0000-0000-000000000003'::uuid, 'invited', NULL, 'direct'),
  ('bb300000-0000-0000-0000-000000000003'::uuid, 'bb200000-0000-0000-0000-000000000001'::uuid,
   'bb100000-0000-0000-0000-000000000004'::uuid, 'declined', 'MON-A', 'direct')
ON CONFLICT (id) DO UPDATE SET status = excluded.status;

-- ---------------------------------------------------------------------------
-- Fleet berth layouts
-- ---------------------------------------------------------------------------
INSERT INTO public.fleet_vehicles (id, name, license_plate, vehicle_type, required_license, berth_layouts)
VALUES (
  'bb400000-0000-0000-0000-000000000001'::uuid, 'Nightliner Berths', '0000 BRT', 'sleeper_bus', 'D',
  '{16,12,16}'::smallint[]
);

SELECT is(
  (SELECT berth_layouts FROM public.fleet_vehicles WHERE id = 'bb400000-0000-0000-0000-000000000001'::uuid),
  '{12,16}'::smallint[],
  'a bus keeps its layouts sorted and without duplicates'
);

SELECT throws_ok(
  $$ UPDATE public.fleet_vehicles SET berth_layouts = '{50}'::smallint[]
     WHERE id = 'bb400000-0000-0000-0000-000000000001'::uuid $$,
  '23514',
  NULL,
  'an implausible berth count is refused'
);

INSERT INTO public.fleet_vehicles (id, name, license_plate, vehicle_type, required_license, berth_layouts)
VALUES (
  'bb400000-0000-0000-0000-000000000002'::uuid, 'Van With Berths', '0000 BRV', 'furgoneta', 'B',
  '{4}'::smallint[]
);

SELECT is(
  (SELECT berth_layouts FROM public.fleet_vehicles WHERE id = 'bb400000-0000-0000-0000-000000000002'::uuid),
  '{}'::smallint[],
  'berth layouts are cleared on vehicles that are not sleeper buses'
);

-- ---------------------------------------------------------------------------
-- Event berths
-- ---------------------------------------------------------------------------
INSERT INTO public.logistics_events (id, event_type, transport_type, event_date, event_time, job_id, timezone, berth_count, transport_provider)
VALUES
  ('bb500000-0000-0000-0000-000000000001'::uuid, 'load', 'sleeper_bus', '2031-05-10', '23:30',
   'bb200000-0000-0000-0000-000000000001'::uuid, 'Europe/Madrid', 16, NULL),
  ('bb500000-0000-0000-0000-000000000002'::uuid, 'load', 'sleeper_bus', '2031-05-10', '23:30',
   'bb200000-0000-0000-0000-000000000001'::uuid, 'Europe/Madrid', 12, 'montoya'),
  ('bb500000-0000-0000-0000-000000000003'::uuid, 'load', 'trailer', '2031-05-10', '08:00',
   'bb200000-0000-0000-0000-000000000001'::uuid, 'Europe/Madrid', 10, NULL);

SELECT is(
  (SELECT berth_count FROM public.logistics_events WHERE id = 'bb500000-0000-0000-0000-000000000003'::uuid),
  NULL::smallint,
  'a trailer run does not keep a berth count'
);

UPDATE public.logistics_events SET transport_type = 'furgoneta'
WHERE id = 'bb500000-0000-0000-0000-000000000002'::uuid;

SELECT is(
  (SELECT berth_count FROM public.logistics_events WHERE id = 'bb500000-0000-0000-0000-000000000002'::uuid),
  NULL::smallint,
  'switching a bus run to another vehicle type clears its berths'
);

-- ---------------------------------------------------------------------------
-- Matrix read model, as management
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'bb100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  (SELECT (e ->> 'berth_count')::integer
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-05-10', '2031-05-10') -> 'events') e
   WHERE e ->> 'id' = 'bb500000-0000-0000-0000-000000000001'),
  16,
  'the matrix returns the berths of a bus run'
);

SELECT is(
  (SELECT (e ->> 'job_crew_count')::integer
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-05-10', '2031-05-10') -> 'events') e
   WHERE e ->> 'id' = 'bb500000-0000-0000-0000-000000000001'),
  2,
  'the matrix counts the job crew who have not declined'
);

SELECT is(
  (SELECT v -> 'berth_layouts'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-05-10', '2031-05-10') -> 'vehicles') v
   WHERE v ->> 'id' = 'bb400000-0000-0000-0000-000000000001'),
  '[12, 16]'::jsonb,
  'the matrix returns each bus''s berth layouts'
);

SELECT lives_ok(
  $$ UPDATE public.logistics_events SET berth_count = 14
     WHERE id = 'bb500000-0000-0000-0000-000000000001'::uuid $$,
  'management can change the berths of a bus run'
);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.logistics_events WHERE job_id = 'bb200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.fleet_vehicles WHERE id IN (
  'bb400000-0000-0000-0000-000000000001'::uuid,
  'bb400000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.timesheets WHERE job_id = 'bb200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.job_assignments WHERE job_id = 'bb200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'bb200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id IN (
  'bb100000-0000-0000-0000-000000000001'::uuid,
  'bb100000-0000-0000-0000-000000000002'::uuid,
  'bb100000-0000-0000-0000-000000000003'::uuid,
  'bb100000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'bb100000-0000-0000-0000-000000000001'::uuid,
  'bb100000-0000-0000-0000-000000000002'::uuid,
  'bb100000-0000-0000-0000-000000000003'::uuid,
  'bb100000-0000-0000-0000-000000000004'::uuid
);

SELECT * FROM finish();
