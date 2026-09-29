CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

BEGIN;

SELECT plan(20);

-- Structural contract
SELECT ok(
  to_regprocedure('public.set_festival_max_stages(uuid,integer)') IS NOT NULL
  AND to_regprocedure('public.save_festival_stage_gear_setup(uuid,integer,jsonb)') IS NOT NULL,
  'the festival stage RPCs exist'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.set_festival_max_stages(uuid,integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.set_festival_max_stages(uuid,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.save_festival_stage_gear_setup(uuid,integer,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.save_festival_stage_gear_setup(uuid,integer,jsonb)', 'EXECUTE'),
  'only signed-in callers can execute the stage RPCs'
);
SELECT ok(
  (
    SELECT bool_and(NOT procedure_record.prosecdef
      AND array_to_string(procedure_record.proconfig, ',') LIKE '%search_path=%')
    FROM pg_proc AS procedure_record
    WHERE procedure_record.oid IN (
      'public.set_festival_max_stages(uuid,integer)'::regprocedure,
      'public.save_festival_stage_gear_setup(uuid,integer,jsonb)'::regprocedure
    )
  ),
  'the stage RPCs are security invoker with a pinned search path'
);

-- Fixtures
SELECT set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  fixture.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.email,
  'test',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
FROM (VALUES
  ('fc100000-0000-0000-0000-000000000001'::uuid, 'fest-gear-admin@test.local'),
  ('fc100000-0000-0000-0000-000000000002'::uuid, 'fest-gear-tech@test.local')
) AS fixture(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('fc100000-0000-0000-0000-000000000001'::uuid, 'fest-gear-admin@test.local', 'Ada', 'Admin', 'admin', 'production'),
  ('fc100000-0000-0000-0000-000000000002'::uuid, 'fest-gear-tech@test.local', 'Tina', 'Técnica', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES
  ('fc200000-0000-0000-0000-000000000001'::uuid, 'Festival Gear RPCs',
   '2032-07-10 08:00:00+02'::timestamptz, '2032-07-14 02:00:00+02'::timestamptz, 'festival', 'Confirmado'),
  ('fc200000-0000-0000-0000-000000000002'::uuid, 'Festival Gear RPCs (denied)',
   '2032-07-10 08:00:00+02'::timestamptz, '2032-07-14 02:00:00+02'::timestamptz, 'festival', 'Confirmado');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'fc100000-0000-0000-0000-000000000001', true);

-- set_festival_max_stages
SELECT is(
  public.set_festival_max_stages('fc200000-0000-0000-0000-000000000001'::uuid, 3),
  3,
  'setting the stage count returns it'
);
SELECT is(
  (SELECT max_stages FROM public.festival_gear_setups
   WHERE job_id = 'fc200000-0000-0000-0000-000000000001'::uuid),
  3,
  'the global gear setup is created with the stage count'
);
SELECT is(
  (SELECT string_agg(name, ',' ORDER BY number) FROM public.festival_stages
   WHERE job_id = 'fc200000-0000-0000-0000-000000000001'::uuid),
  'Stage 1,Stage 2,Stage 3',
  'the missing named stage rows are created'
);

UPDATE public.festival_stages
SET name = 'Escenario principal'
WHERE job_id = 'fc200000-0000-0000-0000-000000000001'::uuid AND number = 1;

SELECT lives_ok(
  $$SELECT public.set_festival_max_stages('fc200000-0000-0000-0000-000000000001'::uuid, 4)$$,
  'adding a stage is idempotent for the existing ones'
);
SELECT is(
  (SELECT string_agg(name, ',' ORDER BY number) FROM public.festival_stages
   WHERE job_id = 'fc200000-0000-0000-0000-000000000001'::uuid),
  'Escenario principal,Stage 2,Stage 3,Stage 4',
  'existing (renamed) stages are kept and only the new one is added'
);
SELECT throws_ok(
  $$SELECT public.set_festival_max_stages('fc200000-0000-0000-0000-000000000001'::uuid, 0)$$,
  '22023', NULL, 'a festival needs at least one stage'
);

-- save_festival_stage_gear_setup
SELECT is(
  (SELECT max_stages FROM public.save_festival_stage_gear_setup(
    'fc200000-0000-0000-0000-000000000001'::uuid, 6,
    '{"notes":"primera","monitors_enabled":true,"monitors_quantity":4,"foh_drive_options":["l_r"],"wired_mics":[{"model":"SM58","quantity":4}],"id":"00000000-0000-0000-0000-000000000000","bogus":1}'::jsonb
  )),
  6,
  'saving a stage widens the global stage count to cover it'
);
SELECT is(
  (SELECT count(*)::integer FROM public.festival_stage_gear_setups AS stage_setup
   JOIN public.festival_gear_setups AS setup ON setup.id = stage_setup.gear_setup_id
   WHERE setup.job_id = 'fc200000-0000-0000-0000-000000000001'::uuid
     AND stage_setup.stage_number = 6
     AND stage_setup.notes = 'primera'
     AND stage_setup.monitors_quantity = 4
     AND stage_setup.foh_drive_options = ARRAY['l_r']
     AND stage_setup.wired_mics = '[{"model":"SM58","quantity":4}]'::jsonb
     AND stage_setup.id <> '00000000-0000-0000-0000-000000000000'::uuid),
  1,
  'the stage row holds the payload and ignores identity keys and unknown keys'
);
SELECT lives_ok(
  $$SELECT * FROM public.save_festival_stage_gear_setup(
    'fc200000-0000-0000-0000-000000000001'::uuid, 6, '{"notes":"segunda"}'::jsonb)$$,
  'saving the same stage again updates it'
);
SELECT is(
  (SELECT count(*)::integer FROM public.festival_stage_gear_setups AS stage_setup
   JOIN public.festival_gear_setups AS setup ON setup.id = stage_setup.gear_setup_id
   WHERE setup.job_id = 'fc200000-0000-0000-0000-000000000001'::uuid
     AND stage_setup.stage_number = 6),
  1,
  'a second save never duplicates the stage row'
);
SELECT is(
  (SELECT stage_setup.notes FROM public.festival_stage_gear_setups AS stage_setup
   JOIN public.festival_gear_setups AS setup ON setup.id = stage_setup.gear_setup_id
   WHERE setup.job_id = 'fc200000-0000-0000-0000-000000000001'::uuid
     AND stage_setup.stage_number = 6),
  'segunda',
  'the second save replaces the stage values'
);
SELECT is(
  (SELECT max_stages FROM public.festival_gear_setups
   WHERE job_id = 'fc200000-0000-0000-0000-000000000001'::uuid),
  6,
  'the widened stage count persists on the global setup'
);
SELECT throws_ok(
  $$SELECT * FROM public.save_festival_stage_gear_setup(
    'fc200000-0000-0000-0000-000000000001'::uuid, 1, '{}'::jsonb)$$,
  '22023', NULL, 'stage 1 is the global setup, not a stage override'
);
SELECT throws_ok(
  $$SELECT * FROM public.save_festival_stage_gear_setup(
    'fc200000-0000-0000-0000-000000000001'::uuid, 2, '[]'::jsonb)$$,
  '22023', NULL, 'the payload must be a JSON object'
);

-- A stage save with no global setup yet creates one in the same transaction
SELECT is(
  (SELECT max_stages FROM public.save_festival_stage_gear_setup(
    'fc200000-0000-0000-0000-000000000002'::uuid, 2, '{"notes":"solo"}'::jsonb)),
  2,
  'saving a stage of a festival with no global setup creates it'
);

-- Row-level security still decides who may write
SELECT set_config('request.jwt.claim.sub', 'fc100000-0000-0000-0000-000000000002', true);

SELECT throws_ok(
  $$SELECT public.set_festival_max_stages('fc200000-0000-0000-0000-000000000002'::uuid, 5)$$,
  '42501', NULL, 'a technician cannot change the stage count'
);
SELECT throws_ok(
  $$SELECT * FROM public.save_festival_stage_gear_setup(
    'fc200000-0000-0000-0000-000000000002'::uuid, 3, '{"notes":"no"}'::jsonb)$$,
  '42501', NULL, 'a technician cannot save a stage gear setup'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

SELECT * FROM finish();
ROLLBACK;
