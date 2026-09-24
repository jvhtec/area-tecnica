CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(23);

-- ---------------------------------------------------------------------------
-- Structure and grants
-- ---------------------------------------------------------------------------
SELECT has_table('public', 'driver_locations', 'driver_locations table exists');
SELECT col_is_pk('public', 'driver_locations', 'driver_id', 'one row per driver: the latest position, no trail');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.driver_locations'::regclass),
  'driver_locations has RLS enabled'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.driver_locations', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.driver_locations', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.driver_locations', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.driver_locations', 'DELETE'),
  'positions are read directly but written only through RPCs'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.driver_locations', 'SELECT')
    AND NOT has_function_privilege('anon', 'public.report_driver_location(double precision, double precision, double precision, double precision, double precision, uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.stop_sharing_driver_location()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_driver_locations()', 'EXECUTE'),
  'anonymous callers cannot read positions or call the tracking RPCs'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'driver_locations'
  ),
  'driver_locations is published over realtime'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.driver_locations WHERE driver_id IN (
  'e5600000-0000-0000-0000-000000000002'::uuid,
  'e5600000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.transport_driver_assignments WHERE logistics_event_id = 'e5700000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.logistics_events WHERE id = 'e5700000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id IN (
  'e5600000-0000-0000-0000-000000000001'::uuid,
  'e5600000-0000-0000-0000-000000000002'::uuid,
  'e5600000-0000-0000-0000-000000000003'::uuid,
  'e5600000-0000-0000-0000-000000000004'::uuid,
  'e5600000-0000-0000-0000-000000000005'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'e5600000-0000-0000-0000-000000000001'::uuid,
  'e5600000-0000-0000-0000-000000000002'::uuid,
  'e5600000-0000-0000-0000-000000000003'::uuid,
  'e5600000-0000-0000-0000-000000000004'::uuid,
  'e5600000-0000-0000-0000-000000000005'::uuid
);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  u.id, '00000000-0000-0000-0000-000000000000'::uuid, u.email, 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('e5600000-0000-0000-0000-000000000001'::uuid, 'track-manager@test.local'),
  ('e5600000-0000-0000-0000-000000000002'::uuid, 'track-driver-ana@test.local'),
  ('e5600000-0000-0000-0000-000000000003'::uuid, 'track-driver-beto@test.local'),
  ('e5600000-0000-0000-0000-000000000004'::uuid, 'track-house@test.local'),
  ('e5600000-0000-0000-0000-000000000005'::uuid, 'track-logistics-role@test.local')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('e5600000-0000-0000-0000-000000000001'::uuid, 'track-manager@test.local', 'Marta', 'Logística', 'management', 'logistics'),
  ('e5600000-0000-0000-0000-000000000002'::uuid, 'track-driver-ana@test.local', 'Ana', 'Conductora', 'conductor', 'logistics'),
  ('e5600000-0000-0000-0000-000000000003'::uuid, 'track-driver-beto@test.local', 'Beto', 'Conductor', 'conductor', 'logistics'),
  ('e5600000-0000-0000-0000-000000000004'::uuid, 'track-house@test.local', 'Hugo', 'Plantilla', 'house_tech', 'sound'),
  ('e5600000-0000-0000-0000-000000000005'::uuid, 'track-logistics-role@test.local', 'Lola', 'Almacén', 'logistics', 'logistics')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.logistics_events (id, event_type, transport_type, event_date, event_time, title, timezone)
VALUES ('e5700000-0000-0000-0000-000000000001'::uuid, 'load', 'trailer', '2031-04-01', '08:00', 'Carga seguimiento', 'Europe/Madrid');

-- Ana is on the transport; Beto is not.
INSERT INTO public.transport_driver_assignments (id, logistics_event_id, driver_id, starts_at, ends_at)
VALUES (
  'e5800000-0000-0000-0000-000000000001'::uuid,
  'e5700000-0000-0000-0000-000000000001'::uuid,
  'e5600000-0000-0000-0000-000000000002'::uuid,
  now() - interval '30 minutes',
  now() + interval '2 hours'
);

-- ---------------------------------------------------------------------------
-- Drivers report their own position
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'e5600000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT ok(
  (public.report_driver_location(41.39, 2.16, 12, 90, 13.9, 'e5800000-0000-0000-0000-000000000001'::uuid)) ? 'recorded_at',
  'a conductor can report their position on their own transport'
);

SELECT is(
  (SELECT assignment_id FROM public.driver_locations WHERE driver_id = 'e5600000-0000-0000-0000-000000000002'::uuid),
  'e5800000-0000-0000-0000-000000000001'::uuid,
  'the position is attached to the transport the driver named'
);

SELECT lives_ok(
  $$ SELECT public.report_driver_location(41.40, 2.17, 8, 95, 12.0, 'e5800000-0000-0000-0000-000000000001'::uuid) $$,
  'a second fix updates the same row'
);

SELECT is(
  (SELECT count(*)::integer FROM public.driver_locations WHERE driver_id = 'e5600000-0000-0000-0000-000000000002'::uuid),
  1,
  'only the latest position is kept, never a trail'
);

SELECT throws_ok(
  $ SELECT public.report_driver_location(95, 2.16) $,
  '22023',
  NULL,
  'an impossible coordinate is refused'
);

SELECT throws_ok(
  $ SELECT public.report_driver_location(40.42, -3.70, 10, NULL, NULL, NULL) $,
  '22023',
  NULL,
  'a position report requires an eligible transport assignment'
);

SELECT throws_ok(
  $$
    INSERT INTO public.driver_locations (driver_id, latitude, longitude)
    VALUES ('e5600000-0000-0000-0000-000000000002'::uuid, 1, 1)
  $$,
  '42501',
  NULL,
  'positions cannot be written directly'
);

SELECT throws_ok(
  $$ SELECT public.get_driver_locations() $$,
  '42501',
  NULL,
  'a driver cannot read the tracking map'
);

-- Beto names Ana's transport: the server refuses the report entirely.
SELECT set_config('request.jwt.claim.sub', 'e5600000-0000-0000-0000-000000000003', false);

SELECT throws_ok(
  $ SELECT public.report_driver_location(40.42, -3.70, 30, NULL, NULL, 'e5800000-0000-0000-0000-000000000001'::uuid) $,
  '22023',
  NULL,
  'a driver cannot report against someone else''s transport'
);

SELECT is(
  (SELECT count(*)::integer FROM public.driver_locations),
  0,
  'a refused report leaves no position row visible to that driver'
);

-- ---------------------------------------------------------------------------
-- Who can watch
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'e5600000-0000-0000-0000-000000000001', false);

SELECT is(
  jsonb_array_length(public.get_driver_locations()),
  1,
  'logistics management sees only eligible shared positions'
);

SELECT is(
  (SELECT r -> 'assignment' ->> 'title'
   FROM jsonb_array_elements(public.get_driver_locations()) r
   WHERE r ->> 'driver_id' = 'e5600000-0000-0000-0000-000000000002'),
  'Carga seguimiento',
  'a position carries the transport the driver is on'
);

SELECT set_config('request.jwt.claim.sub', 'e5600000-0000-0000-0000-000000000004', false);

SELECT is(
  jsonb_array_length(public.get_driver_locations()),
  1,
  'house techs can watch the eligible tracking map'
);

SELECT set_config('request.jwt.claim.sub', 'e5600000-0000-0000-0000-000000000005', false);

SELECT throws_ok(
  $$ SELECT public.get_driver_locations() $$,
  '42501',
  NULL,
  'the logistics role cannot read positions, matching the matrix'
);

SELECT throws_ok(
  $$ SELECT public.report_driver_location(40.42, -3.70) $$,
  '42501',
  NULL,
  'only conductors can report a position'
);

-- ---------------------------------------------------------------------------
-- Stop sharing deletes the row
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'e5600000-0000-0000-0000-000000000002', false);

SELECT is(
  public.stop_sharing_driver_location() ->> 'stopped',
  'true',
  'a driver can stop sharing'
);

SELECT is(
  (SELECT count(*)::integer FROM public.driver_locations WHERE driver_id = 'e5600000-0000-0000-0000-000000000002'::uuid),
  0,
  'stopping removes the stored position entirely'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
DELETE FROM public.driver_locations WHERE driver_id IN (
  'e5600000-0000-0000-0000-000000000002'::uuid,
  'e5600000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.transport_driver_assignments WHERE logistics_event_id = 'e5700000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.logistics_events WHERE id = 'e5700000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id IN (
  'e5600000-0000-0000-0000-000000000001'::uuid,
  'e5600000-0000-0000-0000-000000000002'::uuid,
  'e5600000-0000-0000-0000-000000000003'::uuid,
  'e5600000-0000-0000-0000-000000000004'::uuid,
  'e5600000-0000-0000-0000-000000000005'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'e5600000-0000-0000-0000-000000000001'::uuid,
  'e5600000-0000-0000-0000-000000000002'::uuid,
  'e5600000-0000-0000-0000-000000000003'::uuid,
  'e5600000-0000-0000-0000-000000000004'::uuid,
  'e5600000-0000-0000-0000-000000000005'::uuid
);

SELECT * FROM finish();
