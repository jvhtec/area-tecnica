CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(17);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
SELECT ok(
  'crew_transfer' = ANY (enum_range(NULL::public.logistics_event_type)::text[]),
  'a logistics event can be a crew transfer'
);

-- ---------------------------------------------------------------------------
-- Fixtures: a manager, a driver, two places and a van.
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
  ('cc100000-0000-0000-0000-000000000001'::uuid, 'crew-transfer-manager@test.local'),
  ('cc100000-0000-0000-0000-000000000002'::uuid, 'crew-transfer-driver@test.local')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('cc100000-0000-0000-0000-000000000001'::uuid, 'crew-transfer-manager@test.local', 'Crew', 'Manager', 'management', 'logistics'),
  ('cc100000-0000-0000-0000-000000000002'::uuid, 'crew-transfer-driver@test.local', 'Crew', 'Driver', 'conductor', 'logistics')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.locations (id, name, formatted_address)
VALUES
  ('cc200000-0000-0000-0000-000000000001'::uuid, 'Nave Crew Transfer', 'Calle Nave 1, Madrid'),
  ('cc200000-0000-0000-0000-000000000002'::uuid, 'Recinto Crew Transfer', 'Avenida Recinto 2, Valencia');

INSERT INTO public.fleet_vehicles (id, name, license_plate, vehicle_type, required_license, passenger_seats)
VALUES ('cc300000-0000-0000-0000-000000000001'::uuid, 'Van Crew Transfer', '0000 CRW', 'furgoneta', 'B', 8);

SELECT is(
  (SELECT passenger_seats FROM public.fleet_vehicles WHERE id = 'cc300000-0000-0000-0000-000000000001'::uuid),
  8::smallint,
  'a vehicle records its passenger seats'
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
INSERT INTO public.logistics_events (
  id, event_type, transport_type, event_date, event_time, end_date, end_time,
  origin_location_id, location_id, passenger_count, title, timezone
)
VALUES
  ('cc400000-0000-0000-0000-000000000001'::uuid, 'crew_transfer', 'furgoneta', '2031-06-10', '08:00',
   '2031-06-13', '20:00', 'cc200000-0000-0000-0000-000000000001'::uuid,
   'cc200000-0000-0000-0000-000000000002'::uuid, 6, 'Traslado Crew Transfer', 'Europe/Madrid'),
  ('cc400000-0000-0000-0000-000000000002'::uuid, 'load', 'trailer', '2031-06-11', '09:00',
   NULL, NULL, 'cc200000-0000-0000-0000-000000000001'::uuid, NULL, 5, 'Carga Crew Transfer', 'Europe/Madrid');

SELECT ok(
  (SELECT origin_location_id IS NULL AND passenger_count IS NULL
   FROM public.logistics_events WHERE id = 'cc400000-0000-0000-0000-000000000002'::uuid),
  'a load does not keep a pick-up point or passengers'
);

SELECT throws_ok(
  $$ INSERT INTO public.logistics_events (event_type, transport_type, event_date, event_time, origin_location_id, location_id)
     VALUES ('crew_transfer', 'furgoneta', '2031-06-10', '08:00',
             'cc200000-0000-0000-0000-000000000001'::uuid, 'cc200000-0000-0000-0000-000000000001'::uuid) $$,
  '23514',
  NULL,
  'a crew transfer cannot start and end at the same place'
);

SELECT throws_ok(
  $$ INSERT INTO public.logistics_events (event_type, transport_type, event_date, event_time, end_date, end_time)
     VALUES ('crew_transfer', 'furgoneta', '2031-06-10', '08:00', '2031-06-10', '07:00') $$,
  '23514',
  NULL,
  'a transport cannot end before it starts'
);

SELECT throws_ok(
  $$ INSERT INTO public.logistics_events (event_type, transport_type, event_date, event_time, end_date, end_time)
     VALUES ('crew_transfer', 'furgoneta', '2031-06-10', '08:00', '2031-07-10', '08:00') $$,
  '23514',
  NULL,
  'a transport spans at most 21 days'
);

-- ---------------------------------------------------------------------------
-- Movement type: a planned load inherits its request's, crew transfers have none.
-- ---------------------------------------------------------------------------
-- Inserting a job logs job.created; seed the catalog as the other job fixtures do,
-- since this file can run before any of them.
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('job.updated', 'Job updated', 'management', 'info', false),
  ('job.deleted', 'Job deleted', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'cc500000-0000-0000-0000-000000000001'::uuid, 'Crew Transfer Movement Fixture',
  '2031-06-20 08:00:00+02'::timestamptz, '2031-06-20 23:00:00+02'::timestamptz, 'single'
);

INSERT INTO public.transport_requests (
  id, job_id, department, created_by, status, planning_status,
  movement_type, priority, source_type, is_hoja_relevant
) VALUES (
  'cc600000-0000-0000-0000-000000000001'::uuid, 'cc500000-0000-0000-0000-000000000001'::uuid, 'sound',
  'cc100000-0000-0000-0000-000000000001'::uuid, 'requested', 'requested',
  'pickup', 'normal', 'manual', true
);

INSERT INTO public.logistics_events (id, event_type, transport_type, event_date, event_time, job_id, transport_request_id, timezone)
VALUES (
  'cc400000-0000-0000-0000-000000000003'::uuid, 'load', 'furgoneta', '2031-06-20', '09:00',
  'cc500000-0000-0000-0000-000000000001'::uuid, 'cc600000-0000-0000-0000-000000000001'::uuid, 'Europe/Madrid'
);

SELECT is(
  (SELECT movement_type FROM public.logistics_events WHERE id = 'cc400000-0000-0000-0000-000000000003'::uuid),
  'pickup',
  'a load planned from a request inherits its movement type'
);

UPDATE public.logistics_events SET event_type = 'crew_transfer'
WHERE id = 'cc400000-0000-0000-0000-000000000003'::uuid;

SELECT is(
  (SELECT movement_type FROM public.logistics_events WHERE id = 'cc400000-0000-0000-0000-000000000003'::uuid),
  NULL::text,
  'a crew transfer has no movement type'
);

SELECT throws_ok(
  $$ INSERT INTO public.logistics_events (event_type, transport_type, event_date, event_time, movement_type)
     VALUES ('load', 'trailer', '2031-06-10', '08:00', 'bogus') $$,
  '23514',
  NULL,
  'an unknown movement type is refused'
);

-- ---------------------------------------------------------------------------
-- Assignments, as management
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  public.assign_transport_driver(
    'cc400000-0000-0000-0000-000000000001'::uuid,
    'cc100000-0000-0000-0000-000000000002'::uuid,
    'cc300000-0000-0000-0000-000000000001'::uuid
  ) ->> 'status',
  'saved',
  'a crew transfer can hold a driver and van for several days'
);

SELECT is(
  (SELECT ends_at FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'cc400000-0000-0000-0000-000000000001'::uuid),
  '2031-06-13 20:00:00+02'::timestamptz,
  'the default assignment window runs until the end of the transport'
);

SELECT is(
  public.assign_transport_driver(
    'cc400000-0000-0000-0000-000000000002'::uuid,
    NULL,
    'cc300000-0000-0000-0000-000000000001'::uuid
  ) ->> 'status',
  'conflict',
  'the van is blocked on every day of the crew transfer'
);

SELECT throws_ok(
  $$ SELECT public.assign_transport_driver(
       'cc400000-0000-0000-0000-000000000002'::uuid, NULL, NULL, NULL, NULL, NULL, NULL, false
     ) $$,
  '22023',
  NULL,
  'an assignment still needs a driver or a vehicle'
);

UPDATE public.logistics_events
SET end_date = '2031-06-14'
WHERE id = 'cc400000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT ends_at FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'cc400000-0000-0000-0000-000000000001'::uuid),
  '2031-06-14 20:00:00+02'::timestamptz,
  'an assignment that ended with the transport follows its new end'
);

SELECT throws_ok(
  $$ UPDATE public.logistics_events SET end_date = '2031-06-10', end_time = '07:30', event_time = '07:00'
     WHERE id = 'cc400000-0000-0000-0000-000000000002'::uuid $$,
  '23514',
  NULL,
  'end and start are checked together on edit'
);

SELECT is(
  (SELECT e ->> 'passenger_count' || ' ' || (e ->> 'origin') || ' -> ' || (e ->> 'destination')
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-06-12', '2031-06-12') -> 'events') e
   WHERE e ->> 'id' = 'cc400000-0000-0000-0000-000000000001'),
  '6 Nave Crew Transfer -> Recinto Crew Transfer',
  'the matrix lists a crew transfer on a day it spans, with passengers and route'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT is(
  (SELECT r ->> 'pickup_name'
   FROM jsonb_array_elements(public.get_my_transport_assignments('2031-06-01', '2031-06-30')) r
   WHERE r ->> 'event_id' = 'cc400000-0000-0000-0000-000000000001'),
  'Nave Crew Transfer',
  'the driver sees where to pick the crew up'
);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.transport_driver_assignments WHERE logistics_event_id IN (
  'cc400000-0000-0000-0000-000000000001'::uuid,
  'cc400000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.logistics_events WHERE id IN (
  'cc400000-0000-0000-0000-000000000001'::uuid,
  'cc400000-0000-0000-0000-000000000002'::uuid,
  'cc400000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.transport_requests WHERE id = 'cc600000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'cc500000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.fleet_vehicles WHERE id = 'cc300000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.locations WHERE id IN (
  'cc200000-0000-0000-0000-000000000001'::uuid,
  'cc200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.profiles WHERE id IN (
  'cc100000-0000-0000-0000-000000000001'::uuid,
  'cc100000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'cc100000-0000-0000-0000-000000000001'::uuid,
  'cc100000-0000-0000-0000-000000000002'::uuid
);

SELECT * FROM finish();
