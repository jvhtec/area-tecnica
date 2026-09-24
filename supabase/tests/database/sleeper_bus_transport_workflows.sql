CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(12);

-- ---------------------------------------------------------------------------
-- Every hard-coded transport-type list accepts the company's sleeper buses.
-- ---------------------------------------------------------------------------
SELECT ok(
  'sleeper_bus' = ANY (enum_range(NULL::public.transport_type)::text[]),
  'transport_type includes sleeper_bus'
);

SELECT ok(
  (SELECT bool_and(pg_get_constraintdef(c.oid) LIKE '%sleeper_bus%')
   FROM pg_constraint c
   WHERE c.conname IN (
     'transport_request_items_transport_type_check',
     'hoja_de_ruta_transport_transport_type_check',
     'truck_planner_transport_mappings_transport_type_check'
   ))
  AND (SELECT count(*) FROM pg_constraint c
       WHERE c.conname IN (
         'transport_request_items_transport_type_check',
         'hoja_de_ruta_transport_transport_type_check',
         'truck_planner_transport_mappings_transport_type_check'
       )) = 3,
  'request items, Hoja de Ruta transport rows and truck-planner mappings accept sleeper_bus'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'c9100000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'transport-sleeper-bus@test.local', 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES (
  'c9100000-0000-0000-0000-000000000001'::uuid,
  'transport-sleeper-bus@test.local', 'Bus', 'Planner', 'management', 'logistics'
)
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'c9200000-0000-0000-0000-000000000001'::uuid,
  'Sleeper Bus Transport Fixture', now(), now() + interval '1 day', 'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'c9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

CREATE TEMP TABLE sleeper_bus_request_ids(kind text primary key, request_id uuid);

-- ---------------------------------------------------------------------------
-- Manual requests (TransportRequestDialog / create-transport-request)
-- ---------------------------------------------------------------------------
INSERT INTO sleeper_bus_request_ids(kind, request_id)
SELECT 'manual', public.save_transport_request(
  NULL,
  'c9200000-0000-0000-0000-000000000001'::uuid,
  'sound',
  'Nightliner to the next city',
  NULL, NULL, NULL, NULL, 'transfer', 'normal', true, 'manual', NULL,
  '[{"transport_type":"sleeper_bus","leftover_space_meters":null}]'::jsonb
);

SELECT is(
  (SELECT transport_type::text FROM public.transport_request_items
   WHERE request_id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'manual')),
  'sleeper_bus',
  'a manual transport request can ask for a sleeper bus'
);

SELECT throws_ok(
  $$ SELECT public.save_transport_request(
       NULL,
       'c9200000-0000-0000-0000-000000000001'::uuid,
       'video',
       'Unknown vehicle type',
       NULL, NULL, NULL, NULL, 'transfer', 'normal', true, 'manual', NULL,
       '[{"transport_type":"minibus","leftover_space_meters":null}]'::jsonb
     ) $$,
  '22023',
  NULL,
  'types outside the list are still refused'
);

SELECT lives_ok(
  format(
    'select public.schedule_transport_request(%L::uuid, %L::date, %L::time, %L::date, %L::time)',
    (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'manual'),
    '2026-10-05', '23:00', '2026-10-06', '09:00'
  ),
  'a sleeper bus request can be scheduled'
);

SELECT is(
  (SELECT array_agg(DISTINCT transport_type::text) FROM public.logistics_events
   WHERE transport_request_id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'manual')),
  ARRAY['sleeper_bus'],
  'scheduling creates sleeper-bus logistics events'
);

SELECT is(
  (SELECT count(*)::integer FROM public.logistics_events
   WHERE transport_request_id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'manual')),
  2,
  'a scheduled bus run gets its load and unload events'
);

-- ---------------------------------------------------------------------------
-- Tour logistics generator: unknown types used to be filtered out silently.
-- ---------------------------------------------------------------------------
INSERT INTO sleeper_bus_request_ids(kind, request_id)
SELECT 'tour', public.replace_transport_request_with_items(
  NULL,
  'c9200000-0000-0000-0000-000000000001'::uuid,
  'lights',
  'Tour transport demand',
  'requested',
  'c9100000-0000-0000-0000-000000000001'::uuid,
  '[{"transport_type":"trailer","leftover_space_meters":1},{"transport_type":"sleeper_bus","leftover_space_meters":null}]'::jsonb
);

SELECT is(
  (SELECT array_agg(transport_type::text ORDER BY transport_type::text) FROM public.transport_request_items
   WHERE request_id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'tour')),
  ARRAY['sleeper_bus', 'trailer'],
  'tour logistics keeps a sleeper bus item instead of dropping it'
);

-- ---------------------------------------------------------------------------
-- Truck planner upsert (the planner only covers sound and lights)
-- ---------------------------------------------------------------------------
INSERT INTO sleeper_bus_request_ids(kind, request_id)
SELECT 'truck', public.tp_upsert_department_transport_request(
  'c9200000-0000-0000-0000-000000000001'::uuid,
  'sound',
  'sleeper_bus',
  'Truck planner bus',
  NULL,
  2
);

SELECT is(
  (SELECT transport_type::text FROM public.transport_request_items
   WHERE request_id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'truck')),
  'sleeper_bus',
  'the truck planner can record sleeper-bus demand'
);

SELECT is(
  (SELECT source_type FROM public.transport_requests
   WHERE id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'truck')),
  'truck_planner',
  'truck-planner bus demand keeps its source'
);

-- ---------------------------------------------------------------------------
-- Fleet: a bus can be registered and linked to a bus event's default window.
-- ---------------------------------------------------------------------------
SELECT lives_ok(
  $$
    INSERT INTO public.fleet_vehicles (id, name, license_plate, vehicle_type, required_license)
    VALUES ('c9400000-0000-0000-0000-000000000001'::uuid, 'Nightliner Test', '0000 NLT', 'sleeper_bus', 'D')
  $$,
  'management can register a sleeper bus in the fleet'
);

SELECT is(
  public.assign_transport_driver(
    (SELECT id FROM public.logistics_events
     WHERE transport_request_id = (SELECT request_id FROM sleeper_bus_request_ids WHERE kind = 'manual')
     ORDER BY event_date, event_time LIMIT 1),
    NULL,
    'c9400000-0000-0000-0000-000000000001'::uuid
  ) ->> 'status',
  'saved',
  'a sleeper bus can be put on a sleeper-bus transport in the matrix'
);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DELETE FROM public.transport_driver_assignments
WHERE vehicle_id = 'c9400000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.logistics_event_departments
WHERE event_id IN (
  SELECT id FROM public.logistics_events
  WHERE transport_request_id IN (
    SELECT id FROM public.transport_requests
    WHERE job_id = 'c9200000-0000-0000-0000-000000000001'::uuid
  )
);
DELETE FROM public.logistics_events
WHERE transport_request_id IN (
  SELECT id FROM public.transport_requests
  WHERE job_id = 'c9200000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.fleet_vehicles WHERE id = 'c9400000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.transport_request_items
WHERE request_id IN (
  SELECT id FROM public.transport_requests
  WHERE job_id = 'c9200000-0000-0000-0000-000000000001'::uuid
);
DELETE FROM public.transport_requests
WHERE job_id = 'c9200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'c9200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id = 'c9100000-0000-0000-0000-000000000001'::uuid;
DELETE FROM auth.users WHERE id = 'c9100000-0000-0000-0000-000000000001'::uuid;

SELECT * FROM finish();
