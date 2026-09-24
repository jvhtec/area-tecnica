CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(91);

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
    AND NOT has_function_privilege('anon', 'public.respond_transport_assignment(uuid, text, text)', 'EXECUTE'),
  'logistics matrix RPCs are closed to anonymous callers'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_logistics_matrix(date, date)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.assign_transport_driver(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, boolean)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.get_my_transport_assignments(date, date)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.respond_transport_assignment(uuid, text, text)', 'EXECUTE'),
  'signed-in users can call the RPCs, which authorize internally'
);

SELECT has_column('public', 'fleet_vehicles', 'itv_expiry', 'fleet_vehicles.itv_expiry exists');
SELECT has_column('public', 'fleet_vehicles', 'insurance_expiry', 'fleet_vehicles.insurance_expiry exists');
SELECT has_column('public', 'fleet_vehicles', 'has_tail_lift', 'fleet_vehicles.has_tail_lift exists');
SELECT has_column('public', 'driver_details', 'tachograph_card_expiry', 'driver_details.tachograph_card_expiry exists');
SELECT has_column('public', 'transport_driver_assignments', 'decline_reason', 'transport_driver_assignments.decline_reason exists');
SELECT has_column('public', 'logistics_events', 'location_id', 'logistics_events.location_id exists');
SELECT hasnt_function(
  'public', 'respond_transport_assignment', ARRAY['uuid', 'text'],
  'the two-argument respond overload is gone, so PostgREST calls are unambiguous'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.transport_driver_assignments WHERE logistics_event_id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid,
  'e5300000-0000-0000-0000-000000000005'::uuid
);
DELETE FROM public.logistics_events WHERE id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid,
  'e5300000-0000-0000-0000-000000000005'::uuid
);
DELETE FROM public.driver_details WHERE profile_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.technician_availability WHERE technician_id IN (
  'e5100000-0000-0000-0000-000000000002',
  'e5100000-0000-0000-0000-000000000003'
);
DELETE FROM public.vacation_requests WHERE technician_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.availability_schedules WHERE user_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.fleet_vehicles WHERE id IN (
  'e5400000-0000-0000-0000-000000000001'::uuid,
  'e5400000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.transport_requests WHERE id = 'e5600000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'e5200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.locations WHERE id = 'e5500000-0000-0000-0000-000000000001'::uuid;
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

INSERT INTO public.profiles (id, email, first_name, last_name, role, department, phone)
VALUES
  ('e5100000-0000-0000-0000-000000000001'::uuid, 'fleet-manager@test.local', 'Marta', 'Logística', 'management', 'logistics', NULL),
  ('e5100000-0000-0000-0000-000000000002'::uuid, 'fleet-driver-ana@test.local', 'Ana', 'Conductora', 'conductor', 'logistics', '600 111 222'),
  ('e5100000-0000-0000-0000-000000000003'::uuid, 'fleet-driver-beto@test.local', 'Beto', 'Conductor', 'conductor', 'logistics', NULL),
  ('e5100000-0000-0000-0000-000000000004'::uuid, 'fleet-tech@test.local', 'Tomás', 'Técnico', 'technician', 'sound', NULL),
  ('e5100000-0000-0000-0000-000000000005'::uuid, 'fleet-house@test.local', 'Hugo', 'Plantilla', 'house_tech', 'sound', NULL),
  ('e5100000-0000-0000-0000-000000000006'::uuid, 'fleet-logistics-role@test.local', 'Lola', 'Almacén', 'logistics', 'logistics', NULL)
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department,
    phone = excluded.phone;

-- Beto is off on the 11th (explicit day) and on approved holiday the 12th–13th.
INSERT INTO public.technician_availability (technician_id, date, status)
VALUES ('e5100000-0000-0000-0000-000000000003', '2031-03-11', 'sick');
INSERT INTO public.vacation_requests (technician_id, start_date, end_date, status)
VALUES ('e5100000-0000-0000-0000-000000000003'::uuid, '2031-03-12', '2031-03-13', 'approved');

INSERT INTO public.locations (id, name, formatted_address, latitude, longitude)
VALUES ('e5500000-0000-0000-0000-000000000001'::uuid, 'Nave proveedor', 'Calle Industria 4, Getafe', 40.30571000, -3.73295000);

-- Calendar-only transports (no job) keep the fixture independent of job triggers.
-- The afternoon pickup names its own place; the others have none.
INSERT INTO public.logistics_events (id, event_type, transport_type, event_date, event_time, title, timezone, location_id)
VALUES
  ('e5300000-0000-0000-0000-000000000001'::uuid, 'load', 'trailer', '2031-03-10', '08:00', 'Carga almacén', 'Europe/Madrid', NULL),
  ('e5300000-0000-0000-0000-000000000002'::uuid, 'unload', 'trailer', '2031-03-10', '09:00', 'Descarga recinto', 'Europe/Madrid', NULL),
  ('e5300000-0000-0000-0000-000000000003'::uuid, 'load', 'furgoneta', '2031-03-10', '15:00', 'Recogida tarde', 'Europe/Madrid', 'e5500000-0000-0000-0000-000000000001'::uuid),
  -- A long haul that starts before the ranges queried below and is still running in them.
  ('e5300000-0000-0000-0000-000000000004'::uuid, 'load', 'trailer', '2031-03-08', '20:00', 'Ruta larga', 'Europe/Madrid', NULL),
  -- This run reaches Monday in Helsinki while Madrid is still on Sunday.
  ('e5300000-0000-0000-0000-000000000005'::uuid, 'load', 'trailer', '2031-03-09', '23:30', 'Cruce Helsinki', 'Europe/Helsinki', NULL);

-- ---------------------------------------------------------------------------
-- Management: fleet and assignments
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT is(
  (SELECT r ->> 'location_name'
   FROM jsonb_array_elements(public.get_my_transport_assignments('2031-03-10', '2031-03-10')) r
   WHERE r ->> 'event_id' = 'e5300000-0000-0000-0000-000000000002'),
  'Recinto destino, Madrid',
  'an unload without an explicit event place navigates to the request destination'
);

SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000001', false);

SELECT lives_ok(
  $$
    INSERT INTO public.fleet_vehicles (id, name, license_plate, vehicle_type, required_license)
    VALUES
      ('e5400000-0000-0000-0000-000000000001'::uuid, 'Tráiler 1', '1234 ABC', 'trailer', 'C+E'),
      ('e5400000-0000-0000-0000-000000000002'::uuid, 'Furgoneta 1', '5678-DEF', 'furgoneta', 'B')
  $$,
  'logistics management can register fleet vehicles'
);

SELECT is(
  (SELECT created_by FROM public.fleet_vehicles WHERE id = 'e5400000-0000-0000-0000-000000000001'::uuid),
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'fleet created_by is set from the authenticated actor'
);

SELECT lives_ok(
  $$
    UPDATE public.fleet_vehicles
    SET required_license = 'B+E'
    WHERE id = 'e5400000-0000-0000-0000-000000000002'::uuid
  $$,
  'fleet accepts the B+E Spanish licence category'
);

SELECT lives_ok(
  $$
    UPDATE public.fleet_vehicles
    SET itv_expiry = '2031-01-31', insurance_expiry = '2031-06-30', has_tail_lift = true
    WHERE id = 'e5400000-0000-0000-0000-000000000002'::uuid
  $$,
  'fleet records ITV and insurance expiry and a tail lift'
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
  (SELECT updated_by FROM public.driver_details WHERE profile_id = 'e5100000-0000-0000-0000-000000000002'::uuid),
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'driver_details updated_by is set from the authenticated actor'
);

SELECT lives_ok(
  $$
    UPDATE public.driver_details
    SET tachograph_card_expiry = '2032-01-01'
    WHERE profile_id = 'e5100000-0000-0000-0000-000000000002'::uuid
  $$,
  'driver details record the tachograph card expiry'
);

-- Matrix read model: availability, compliance and the manager-only phone.
SELECT is(
  (SELECT d -> 'unavailable_days'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-10', '2031-03-13') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000003'),
  '[{"date": "2031-03-11", "status": "sick"}, {"date": "2031-03-12", "status": "vacation"}, {"date": "2031-03-13", "status": "vacation"}]'::jsonb,
  'the matrix lists a driver''s days off from availability rows and approved vacations'
);

SELECT is(
  (SELECT d -> 'unavailable_days'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-09', '2031-03-10') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000003'),
  '[]'::jsonb,
  'days off outside the queried range are not returned'
);

SELECT is(
  (SELECT d ->> 'phone'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-10', '2031-03-10') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000002'),
  '600 111 222',
  'management gets a driver''s phone for dispatch'
);

SELECT is(
  (SELECT d ->> 'tachograph_card_expiry'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-10', '2031-03-10') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000002'),
  '2032-01-01',
  'the matrix exposes the tachograph card expiry'
);

SELECT ok(
  (SELECT bool_and(v ? 'itv_expiry' AND v ? 'insurance_expiry' AND v ? 'has_tail_lift')
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-10', '2031-03-10') -> 'vehicles') v),
  'the matrix exposes vehicle compliance fields'
);

SELECT lives_ok(
  $$
    UPDATE public.driver_details
    SET license_categories = ARRAY['B', 'B+E', 'C', 'C+E', 'D+E']
    WHERE profile_id = 'e5100000-0000-0000-0000-000000000002'::uuid
  $$,
  'driver details accept the complete trailer licence categories'
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

UPDATE public.logistics_events
SET timezone = NULL
WHERE id = 'e5300000-0000-0000-0000-000000000004'::uuid;

SELECT is(
  (SELECT timezone FROM public.logistics_events WHERE id = 'e5300000-0000-0000-0000-000000000004'::uuid),
  'Europe/Madrid',
  'a logistics event with no explicit or job timezone falls back to Madrid'
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
  public.get_my_transport_assignments('2031-03-01', '2031-03-31')->0->>'timezone',
  'Europe/Madrid',
  'a driver assignment exposes the transport timezone'
);

SELECT ok(
  public.get_my_transport_assignments('2031-03-01', '2031-03-31')->0
    ?& ARRAY['job_id', 'location_lat', 'location_lng', 'decline_reason'],
  'a driver assignment carries the job id, venue coordinates and their own decline reason'
);

SELECT is(
  (SELECT r ->> 'location_name' || ' @ ' || (r ->> 'location_lat')
   FROM jsonb_array_elements(public.get_my_transport_assignments('2031-03-01', '2031-03-31')) r
   WHERE r ->> 'event_id' = 'e5300000-0000-0000-0000-000000000003'),
  'Nave proveedor @ 40.30571000',
  'a transport with its own place gives the driver that place and its coordinates'
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
    'declined',
    '  Tengo otro servicio  '
  ) ->> 'status',
  'declined',
  'a driver can decline their own assignment'
);

SELECT is(
  (SELECT decline_reason FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000003'::uuid),
  'Tengo otro servicio',
  'the decline reason is stored, trimmed'
);

SELECT throws_ok(
  $$
    SELECT public.respond_transport_assignment(
      (SELECT id FROM public.transport_driver_assignments
       WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000003'::uuid),
      'declined',
      repeat('x', 501)
    )
  $$,
  '22023',
  NULL,
  'a decline reason longer than 500 characters is refused'
);

SELECT is(
  public.respond_transport_assignment(
    (SELECT id FROM public.transport_driver_assignments
     WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid),
    'confirmed',
    'ignored on a confirmation'
  ) ->> 'decline_reason',
  NULL::text,
  'a driver can confirm their own assignment, and a confirmation carries no reason'
);

SELECT ok(
  jsonb_array_length(public.get_my_transport_assignments()) >= 3,
  'by default a driver sees every upcoming transport, however far ahead'
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

SELECT is(
  (SELECT d ->> 'phone'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-10', '2031-03-10') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000002'),
  NULL::text,
  'read-only viewers never receive a driver''s phone'
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

SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000005'::uuid,
    'e5100000-0000-0000-0000-000000000003'::uuid,
    NULL,
    '2031-03-09 23:30 Europe/Helsinki'::timestamptz,
    '2031-03-10 00:15 Europe/Helsinki'::timestamptz,
    p_force => true
  ) ->> 'status',
  'saved',
  'a forced fixture can cross a local midnight ahead of Madrid'
);

SELECT ok(
  (SELECT bool_or(e ->> 'id' = 'e5300000-0000-0000-0000-000000000005')
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-10', '2031-03-10') -> 'events') e),
  'the matrix includes an out-of-date event whose assignment overlaps the day in its own timezone'
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

SELECT ok(
  (SELECT bool_or(e ->> 'event_id' = 'e5300000-0000-0000-0000-000000000005')
   FROM jsonb_array_elements(public.get_my_transport_assignments('2031-03-10', '2031-03-10')) e),
  'a driver date range uses the transport timezone at a local-midnight boundary'
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
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000002'::uuid,
    'e5100000-0000-0000-0000-000000000002'::uuid,
    NULL,
    p_notes => 'Llaves en portería',
    p_assignment_id => (SELECT id FROM public.transport_driver_assignments
                        WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid),
    p_force => true
  ) ->> 'material_change',
  'true',
  'changing only the driver instructions counts as a material change'
);

-- Separate statement: the update above is not visible inside its own statement.
SELECT is(
  (SELECT status FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid),
  'assigned',
  'new instructions ask the driver to confirm again'
);

SELECT is(
  public.remove_transport_driver_assignment(
    (SELECT id FROM public.transport_driver_assignments
     WHERE driver_id = 'e5100000-0000-0000-0000-000000000003'::uuid
       AND logistics_event_id = 'e5300000-0000-0000-0000-000000000003'::uuid)
  ) ->> 'driver_id',
  'e5100000-0000-0000-0000-000000000003',
  'removal returns the driver to notify'
);

-- With the van free again, Ana's refused slot can be re-planned (later that day, same van).
SELECT is(
  public.assign_transport_driver(
    'e5300000-0000-0000-0000-000000000003'::uuid,
    'e5100000-0000-0000-0000-000000000002'::uuid,
    'e5400000-0000-0000-0000-000000000002'::uuid,
    '2031-03-10 17:00 Europe/Madrid'::timestamptz,
    '2031-03-10 19:00 Europe/Madrid'::timestamptz,
    p_assignment_id => current_setting('test.ana_declined')::uuid,
    p_force => true
  ) ->> 'status',
  'saved',
  'a refused transport can be re-planned for the same driver'
);

SELECT is(
  (SELECT decline_reason FROM public.transport_driver_assignments
   WHERE id = current_setting('test.ana_declined')::uuid),
  NULL::text,
  'a material change clears the stale decline reason along with the refusal'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

-- Beto still has the long haul ahead of him.
SELECT throws_ok(
  $$ UPDATE public.profiles SET role = 'technician' WHERE id = 'e5100000-0000-0000-0000-000000000003'::uuid $$,
  '23514',
  NULL,
  'a conductor with upcoming transports cannot lose the role until they are reassigned'
);

SELECT lives_ok(
  $$ UPDATE public.profiles SET department = 'logistics' WHERE id = 'e5100000-0000-0000-0000-000000000003'::uuid $$,
  'other profile edits on a busy conductor are unaffected'
);

SELECT throws_ok(
  $$ DELETE FROM public.logistics_events WHERE id = 'e5300000-0000-0000-0000-000000000001'::uuid $$,
  '23514',
  NULL,
  'a live driver assignment blocks destructive transport deletion and replanning'
);

SELECT lives_ok(
  $$
    DELETE FROM public.transport_driver_assignments
    WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000001'::uuid
  $$,
  'the assignment can be removed explicitly before deleting the transport'
);

DELETE FROM public.logistics_events WHERE id = 'e5300000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT count(*)::integer FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000001'::uuid),
  0,
  'transport deletion succeeds after its assignment is explicitly removed'
);

SELECT throws_ok(
  $$ DELETE FROM public.profiles WHERE id = 'e5100000-0000-0000-0000-000000000003'::uuid $$,
  '23514',
  NULL,
  'a conductor with upcoming transports cannot be deleted'
);

SELECT ok(
  (SELECT count(*) = 4
   FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND schemaname = 'public'
     AND tablename = ANY (ARRAY[
       'transport_driver_assignments',
       'fleet_vehicles',
       'driver_details',
       'transport_requests'
     ])),
  'realtime publication includes the aggregate logistics sources added by this feature'
);

SELECT throws_ok(
  $$ DELETE FROM public.fleet_vehicles WHERE id = 'e5400000-0000-0000-0000-000000000002'::uuid $$,
  '23503',
  NULL,
  'a vehicle with assignment history cannot be deleted, only deactivated'
);

-- ---------------------------------------------------------------------------
-- Calendar edits keep the driver state machine coherent.
-- ---------------------------------------------------------------------------
INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'e5200000-0000-0000-0000-000000000001'::uuid,
  'Destino navegación',
  '2031-03-10 08:00 Europe/Madrid'::timestamptz,
  '2031-03-10 23:00 Europe/Madrid'::timestamptz,
  'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

INSERT INTO public.transport_requests (
  id, job_id, department, created_by, description, status, planning_status,
  movement_type, priority, source_type, is_hoja_relevant, origin, destination
) VALUES (
  'e5600000-0000-0000-0000-000000000001'::uuid,
  'e5200000-0000-0000-0000-000000000001'::uuid,
  'sound',
  'e5100000-0000-0000-0000-000000000001'::uuid,
  'Ruta navegación',
  'requested', 'planned', 'transfer', 'normal', 'manual', true,
  'Nave Sector-Pro, Madrid',
  'Recinto destino, Madrid'
)
ON CONFLICT (id) DO UPDATE
SET origin = excluded.origin,
    destination = excluded.destination,
    planning_status = excluded.planning_status,
    status = excluded.status;

UPDATE public.logistics_events
SET job_id = 'e5200000-0000-0000-0000-000000000001'::uuid,
    transport_request_id = 'e5600000-0000-0000-0000-000000000001'::uuid
WHERE id = 'e5300000-0000-0000-0000-000000000002'::uuid;

UPDATE public.transport_driver_assignments
SET status = 'confirmed', responded_at = now()
WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid;

INSERT INTO public.logistics_event_departments (event_id, department)
VALUES ('e5300000-0000-0000-0000-000000000002'::uuid, 'sound')
ON CONFLICT DO NOTHING;

INSERT INTO public.technician_availability (technician_id, date, status)
VALUES ('e5100000-0000-0000-0000-000000000002', '2031-03-14', 'unavailable')
ON CONFLICT (technician_id, date) DO UPDATE SET status = excluded.status;

DELETE FROM public.availability_schedules
WHERE user_id = 'e5100000-0000-0000-0000-000000000003'::uuid
  AND date = '2031-03-14';
INSERT INTO public.availability_schedules (user_id, date, department, status, source)
VALUES (
  'e5100000-0000-0000-0000-000000000003'::uuid,
  '2031-03-14',
  'logistics',
  'unavailable',
  'warehouse'
);

SELECT set_config(
  'test.event2_start',
  (SELECT starts_at::text
   FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid),
  false
);

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $ UPDATE public.logistics_events
     SET event_time = '10:00'
     WHERE id = 'e5300000-0000-0000-0000-000000000002'::uuid $,
  'a material calendar time edit updates an assigned transport atomically'
);

SELECT is(
  (SELECT status
   FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid),
  'assigned',
  'a calendar plan change clears the driver confirmation'
);

SELECT ok(
  (SELECT starts_at
   FROM public.transport_driver_assignments
   WHERE logistics_event_id = 'e5300000-0000-0000-0000-000000000002'::uuid)
    = current_setting('test.event2_start')::timestamptz + interval '1 hour',
  'changing the event time shifts the assignment window by the same delta'
);

SELECT is(
  cardinality(public.get_event_driver_assignment_ids(
    'e5300000-0000-0000-0000-000000000002'::uuid
  )),
  1,
  'driver notification recipients are derived from the event assignments'
);

SELECT throws_ok(
  $ SELECT public.delete_logistics_event(
       'e5300000-0000-0000-0000-000000000002'::uuid
     ) $,
  '23514',
  NULL,
  'transactional deletion is refused while the event still has a live assignment'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.logistics_event_departments
   WHERE event_id = 'e5300000-0000-0000-0000-000000000002'::uuid
     AND department = 'sound'),
  1,
  'a refused event delete rolls its department deletion back'
);

SELECT ok(
  (SELECT d -> 'unavailable_days'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-14', '2031-03-14') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000002')
  @> '[{"date":"2031-03-14","status":"unavailable"}]'::jsonb
  AND
  (SELECT d -> 'unavailable_days'
   FROM jsonb_array_elements(public.get_logistics_matrix('2031-03-14', '2031-03-14') -> 'drivers') d
   WHERE d ->> 'id' = 'e5100000-0000-0000-0000-000000000003')
  @> '[{"date":"2031-03-14","status":"warehouse"}]'::jsonb,
  'the matrix preserves canonical unavailable/warehouse states from both availability stores'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
DELETE FROM public.transport_driver_assignments WHERE logistics_event_id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid,
  'e5300000-0000-0000-0000-000000000005'::uuid
);
DELETE FROM public.logistics_events WHERE id IN (
  'e5300000-0000-0000-0000-000000000001'::uuid,
  'e5300000-0000-0000-0000-000000000002'::uuid,
  'e5300000-0000-0000-0000-000000000003'::uuid,
  'e5300000-0000-0000-0000-000000000004'::uuid,
  'e5300000-0000-0000-0000-000000000005'::uuid
);
DELETE FROM public.driver_details WHERE profile_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.technician_availability WHERE technician_id IN (
  'e5100000-0000-0000-0000-000000000002',
  'e5100000-0000-0000-0000-000000000003'
);
DELETE FROM public.vacation_requests WHERE technician_id IN (
  'e5100000-0000-0000-0000-000000000002'::uuid,
  'e5100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.fleet_vehicles WHERE id IN (
  'e5400000-0000-0000-0000-000000000001'::uuid,
  'e5400000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.locations WHERE id = 'e5500000-0000-0000-0000-000000000001'::uuid;
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
