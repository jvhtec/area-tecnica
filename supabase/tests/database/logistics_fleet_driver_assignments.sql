CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(43);

-- ---------------------------------------------------------------------------
-- Structure and grants
-- ---------------------------------------------------------------------------
SELECT has_table('public', 'fleet_vehicles', 'fleet_vehicles table exists');
SELECT has_table('public', 'driver_details', 'driver_details table exists');
SELECT has_table('public', 'transport_driver_assignments', 'transport_driver_assignments table exists');

SELECT ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN (
     'public.fleet_vehicles'::regclass,
     'public.driver_details'::regclass,
     'public.transport_driver_assignments'::regclass
   )),
  'fleet, driver detail and assignment tables have RLS enabled'
);

SELECT ok(
  'conductor' = ANY (enum_range(NULL::public.user_role)::text[]),
  'user_role includes conductor'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.transport_driver_assignments', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.transport_driver_assignments', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.transport_driver_assignments', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.transport_driver_assignments', 'DELETE'),
  'assignments are read directly but written only through RPCs'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.fleet_vehicles', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.driver_details', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.transport_driver_assignments', 'SELECT'),
  'anonymous callers cannot read the fleet, drivers or assignments'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_logistics_matrix(date, date)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.assign_transport_driver(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.remove_transport_driver_assignment(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_transport_assignments(date, date)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.respond_transport_assignment(uuid, text)', 'EXECUTE'),
  'logistics matrix RPCs are closed to anonymous callers'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_logistics_matrix(date, date)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.assign_transport_driver(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, boolean)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.get_my_transport_assignments(date, date)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.respond_transport_assignment(uuid, text)', 'EXECUTE'),
  'signed-in users can call the RPCs, which authorize internally'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.transport_driver_assignments WHERE logistics_event_id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.logistics_events WHERE id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.driver_details WHERE profile_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.fleet_vehicles WHERE id IN (
  'e5400000-0000-0000-0000-000000000001'::uuid,
  'e5400000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.profiles WHERE id IN (
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid,
  'e5100000-0000-0000-0000-000000000004'::uuid,
  'e5100000-0000-0000-0000-000000000005'::uuid,
  'e5100000-0000-0000-0000-000000000006'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid,
  'e5100000-0000-0000-0000-000000000004'::uuid,
  'e5100000-0000-0000-0000-000000000005'::uuid,
  'e5100000-0000-0000-0000-000000000006'::uuid
);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  u.id, '00000000-0000-0000-0000-000000000000'::uuid, u.email, 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('e5100000-0000-0000-0000-000000000001'::uuid, 'fleet-manager@test.local'),
  ('e5100000-0000-0000-0000-000000000002'::uuid, 'fleet-driver-ana@test.local'),
  ('e5100000-0000-0000-0000-000000000003'::uuid, 'fleet-driver-beto@test.local'),
  ('e5100000-0000-0000-0000-000000000004'::uuid, 'fleet-tech@test.local'),
  ('e5100000-0000-0000-0000-000000000005'::uuid, 'fleet-house@test.local'),
  ('e5100000-0000-0000-0000-000000000006'::uuid, 'fleet-logistics-role@test.local')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('e5100000-0000-0000-0000-000000000001'::uuid, 'fleet-manager@test.local', 'Marta', 'Logística', 'management', 'logistics'),
  ('e5100000-0000-0000-0000-000000000002'::uuid, 'fleet-driver-ana@test.local', 'Ana', 'Conductora', 'conductor', 'logistics'),
  ('e5100000-0000-0000-0000-000000000003'::uuid, 'fleet-driver-beto@test.local', 'Beto', 'Conductor', 'conductor', 'logistics'),
  ('e5100000-0000-0000-0000-000000000004'::uuid, 'fleet-tech@test.local', 'Tomás', 'Técnico', 'technician', 'sound'),
  ('e5100000-0000-0000-0000-000000000005'::uuid, 'fleet-house@test.local', 'Hugo', 'Plantilla', 'house_tech', 'sound'),
  ('e5100000-0000-0000-0000-000000000006'::uuid, 'fleet-logistics-role@test.local', 'Lola', 'Almacén', 'logistics', 'logistics')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

-- Calendar-only transports (no job) keep the fixture independent of job triggers.
INSERT INTO public.logistics_events (id, event_type, transport_type, event_date, event_time, title, timezone)
VALUES
  ('e5300000-0000-0000-0000-000000000001'::uuid, 'load', 'trailer', '2031-03-10', '08:00', 'Carga almacén', 'Europe/Madrid'),
  ('e5300000-0000-0000-0000-000000000002'::uuid, 'unload', 'trailer', '2031-03-10', '09:00', 'Descarga recinto', 'Europe/Madrid'),
  ('e5300000-0000-0000-0000-000000000003'::uuid, 'load', 'furgoneta', '2031-03-10', '15:00', 'Recogida tarde', 'Europe/Madrid'),
  -- A long haul that starts before the ranges queried below and is still running in them.
  ('e5300000-0000-0000-0000-000000000004'::uuid, 'load', 'trailer', '2031-03-08', '20:00', 'Ruta larga', 'Europe/Madrid');

-- ---------------------------------------------------------------------------
-- Management: fleet and assignments
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO public.fleet_vehicles (id, name, license_plate, vehicle_type, required_license)
    VALUES
      ('e5400000-0000-0000-0000-000000000001'::uuid, 'Tráiler 1', '1234 ABC', 'trailer', 'C+E'),
      ('e5400000-0000-0000-0000-000000000002'::uuid, 'Furgoneta 1', '5678-DEF', 'furgoneta', 'B')
  $$,
  'logistics management can register fleet vehicles'
);

SELECT throws_ok(
  $$ INSERT INTO public.fleet_vehicles (name, license_plate, vehicle_type) VALUES ('Duplicada', '1234abc', 'trailer') $$,
  '23505',
  NULL,
  'plates are unique regardless of spacing, dashes and case'
);

SELECT lives_ok(
  $$
    INSERT INTO public.driver_details (profile_id, license_categories)
    VALUES ('e5100000-0000-0000-0000-000000000002'::uuid, ARRAY['B', 'C', 'C+E'])
  $$,
  'logistics management can record a driver''s licences'
);

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000001'::uuid,
    'e5100000-0000-0000-0000-000000000002'::uuid,
    'e5400000-0000-0000-0000-000000000001'::uuid
  ) ->> 'status',
  'saved',
  'a driver and vehicle can be assigned to a scheduled transport'
);

SELECT is(
  (SELECT starts_at FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000001'::uuid),
  '2031-03-10 08:00:00 Europe/Madrid'::timestamptz,
  'the window defaults to the transport''s local date and time'
);

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000002'::uuid,
    'e5100000-0000-0000-0000-000000000002'::uuid,
    NULL
  ) ->> 'status',
  'conflict',
  'an overlapping window for the same driver is reported instead of saved'
);

SELECT is(
  (SELECT count(*)::integer FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid),
  0,
  'a reported conflict writes nothing'
);

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000003'::uuid,
    'e5100000-0000-0000-0000-000000000002'::uuid,
    'e5400000-0000-0000-0000-000000000002'::uuid
  ) ->> 'status',
  'saved',
  'the same driver can run a second, non-overlapping transport on the same day'
);

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000002'::uuid,
    'e5100000-0000-0000-0000-000000000002'::uuid,
    NULL,
    p_force => true
  ) ->> 'status',
  'saved',
  'an acknowledged conflict can be forced'
);

SELECT throws_ok(
  $$
    SELECT public.assign_transport_driver(
      'e5300000-0000-0000-0000-000000000001'::uuid,
      'e5100000-0000-0000-0000-000000000004'::uuid,
      NULL
    )
  $$,
  '22023',
  NULL,
  'only conductor profiles can be assigned as drivers'
);

SELECT throws_ok(
  $$
    INSERT INTO public.transport_driver_assignments (logistics_event_id, driver_id, starts_at, ends_at)
    VALUES ('e5300000-0000-0000-0000-000000000001'::uuid, 'e5100000-0000-0000-0000-000000000003'::uuid, now(), now() + interval '1 hour')
  $$,
  '42501',
  NULL,
  'assignments cannot be written directly, bypassing the conflict checks'
);

SELECT is(
  (SELECT jsonb_array_length(public.get_logistics_matrix('2031-03-09', '2031-03-11') -> 'assignments')),
  3,
  'the matrix read model returns every assignment in the range'
);

-- ---------------------------------------------------------------------------
-- Conductors: minimal, self-scoped visibility
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000002', false);

SELECT is(
  jsonb_array_length(public.get_my_transport_assignments('2031-03-01', '2031-03-31')),
  3,
  'a driver lists their own transports'
);

SELECT is(
  (SELECT count(*)::integer FROM public.fleet_vehicles),
  2,
  'a driver sees the vehicles on their own assignments'
);

SELECT throws_ok(
  $$ SELECT public.get_logistics_matrix('2031-03-09', '2031-03-11') $$,
  '42501',
  NULL,
  'a driver cannot read the whole matrix'
);

SELECT throws_ok(
  $$ INSERT INTO public.fleet_vehicles (name, license_plate, vehicle_type) VALUES ('Mía', 'X-1', 'trailer') $$,
  '42501',
  NULL,
  'a driver cannot edit the fleet'
);

SELECT is(
  public.respond_transport_assignment(
    (SELECT id FROM public.transport_driver_assignments
     WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000003'::uuid),
    'declined'
  ) ->> 'status',
  'declined',
  'a driver can decline their own assignment'
);

-- Captured while Ana can still see the row, so Beto's attempt targets a real assignment.
SELECT set_config(
  'test.ana_assignment',
  (SELECT id::text FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000001'::uuid),
  false
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000003', false);

SELECT is(
  (SELECT count(*)::integer FROM public.transport_driver_assignments),
  0,
  'another driver does not see someone else''s assignments'
);

SELECT is(
  (SELECT count(*)::integer FROM public.fleet_vehicles),
  0,
  'a driver without assignments sees no vehicles'
);

SELECT is(
  jsonb_array_length(public.get_my_transport_assignments('2031-03-01', '2031-03-31')),
  0,
  'a driver without assignments lists nothing'
);

SELECT throws_ok(
  $$
    SELECT public.respond_transport_assignment(
      current_setting('test.ana_assignment')::uuid,
      'confirmed'
    )
  $$,
  'P0002',
  NULL,
  'a driver cannot answer for another driver'
);

-- ---------------------------------------------------------------------------
-- Other roles
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000004', false);

SELECT is(
  (SELECT count(*)::integer FROM public.transport_driver_assignments),
  0,
  'freelance technicians see no driver assignments'
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000005', false);

SELECT ok(
  (SELECT jsonb_array_length(public.get_logistics_matrix('2031-03-09', '2031-03-11') -> 'drivers')) >= 2,
  'house techs can read the logistics matrix'
);

SELECT throws_ok(
  $$
    SELECT public.assign_transport_driver(
      'e5300000-0000-0000-0000-000000000003'::uuid,
      'e5100000-0000-0000-0000-000000000003'::uuid,
      NULL
    )
  $$,
  '42501',
  NULL,
  'house techs cannot assign drivers'
);

-- ---------------------------------------------------------------------------
-- Declined rows release the slot; removal and cascade
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000001', false);

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000003'::uuid,
    'e5100000-0000-0000-0000-000000000003'::uuid,
    'e5400000-0000-0000-0000-000000000002'::uuid
  ) ->> 'status',
  'saved',
  'a declined assignment releases its vehicle for a replacement driver'
);

-- Ana's refusal was re-covered with the same van; taking it back would double-book it.
SELECT set_config(
  'test.ana_declined',
  (SELECT id::text FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000003'::uuid
     AND driver_id = 'e5100000-0000-0000-0000-000000000002'::uuid),
  false
);

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000004'::uuid,
    'e5100000-0000-0000-0000-000000000003'::uuid,
    NULL,
    '2031-03-08 20:00 Europe/Madrid'::timestamptz,
    '2031-03-10 10:00 Europe/Madrid'::timestamptz
  ) ->> 'status',
  'saved',
  'a multi-day haul can be assigned with an explicit window'
);

SELECT ok(
  (SELECT bool_or(e ->> 'id' = 'e5300000-0000-0000-0000-000000000004')
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-09', '2031-03-11') -> 'events') e),
  'the matrix returns the transport of every assignment overlapping the range'
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000002', false);

SELECT throws_ok(
  $$ SELECT public.respond_transport_assignment(current_setting('test.ana_declined')::uuid, 'confirmed') $$,
  '23P01',
  NULL,
  'a driver cannot re-accept a refused slot that would double-book the vehicle'
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000003', false);

SELECT ok(
  (SELECT bool_or(e ->> 'event_id' = 'e5300000-0000-0000-0000-000000000004')
   FROM jsonb_array_elements(public.get_my_transport_assignments('2031-03-10', '2031-03-10')) e),
  'a driver still sees a run that started before the range and has not ended'
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000006', false);

SELECT throws_ok(
  $$ SELECT public.get_logistics_matrix('2031-03-09', '2031-03-11') $$,
  '42501',
  NULL,
  'the logistics role cannot read the driver matrix it has no page for'
);

SELECT is(
  (SELECT count(*)::integer FROM public.fleet_vehicles)
    + (SELECT count(*)::integer FROM public.driver_details)
    + (SELECT count(*)::integer FROM public.transport_driver_assignments),
  0,
  'the logistics role cannot read fleet, driver or assignment rows directly'
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000001', false);

SELECT is(
  public.remove_transport_driver_assignment(
    (SELECT id FROM public.transport_driver_assignments
     WHERE driver_id = 'e5100000-0000-0000-0000-000000000003'::uuid
       AND logistics_event_id = 'e5300000-0000-0000-0000-000000000003'::uuid)
  ) ->> 'driver_id',
  'e5100000-0000-0000-0000-000000000003',
  'removal returns the driver to notify'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.logistics_events WHERE id = 'e5300000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT count(*)::integer FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000001'::uuid),
  0,
  'deleting a transport removes its driver assignments'
);

SELECT throws_ok(
  $$ DELETE FROM public.fleet_vehicles WHERE id = 'e5400000-0000-0000-0000-000000000002'::uuid $$,
  '23503',
  NULL,
  'a vehicle with assignment history cannot be deleted, only deactivated'
);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
DELETE FROM public.transport_driver_assignments WHERE logistics_event_id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.logistics_events WHERE id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.driver_details WHERE profile_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.fleet_vehicles WHERE id IN (
  'e5400000-0000-0000-0000-000000000001'::uuid,
  'e5400000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.profiles WHERE id IN (
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid,
  'e5100000-0000-0000-0000-000000000004'::uuid,
  'e5100000-0000-0000-0000-000000000005'::uuid,
  'e5100000-0000-0000-0000-000000000006'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid,
  'e5100000-0000-0000-0000-000000000004'::uuid,
  'e5100000-0000-0000-0000-000000000005'::uuid,
  'e5100000-0000-0000-0000-000000000006'::uuid
);

SELECT * FROM finish();
