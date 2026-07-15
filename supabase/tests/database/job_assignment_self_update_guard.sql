CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(9);

-- ---------------------------------------------------------------------------
-- Structural assertions
-- ---------------------------------------------------------------------------

SELECT ok(
  to_regprocedure('public.enforce_job_assignment_self_update()') IS NOT NULL,
  'enforce_job_assignment_self_update() trigger function exists'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.enforce_job_assignment_self_update()')
  ), false),
  'enforce_job_assignment_self_update() pins pg_catalog/public search_path'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.job_assignments'::regclass
      AND tgname = 'enforce_job_assignment_self_update'
      AND NOT tgisinternal
  ),
  'BEFORE UPDATE guard trigger is attached to job_assignments'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.job_assignments'::regclass
      AND tgname = 'trigger_delete_timesheets'
      AND NOT tgisinternal
  ),
  'duplicate AFTER DELETE cascade trigger has been removed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.job_assignments'::regclass
      AND tgname = 'trigger_delete_timesheets_on_assignment_removal'
      AND NOT tgisinternal
  ),
  'the BEFORE DELETE cascade trigger is retained'
);

-- ---------------------------------------------------------------------------
-- Behavioral seed (as service role)
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'c9100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'guard-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'c9100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'guard-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('c9100000-0000-0000-0000-000000000001'::uuid, 'guard-manager@test.local', 'Guard', 'Manager', 'management', 'sound'),
  ('c9100000-0000-0000-0000-000000000002'::uuid, 'guard-tech@test.local', 'Guard', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES (
  'c9200000-0000-0000-0000-000000000001'::uuid,
  'Assignment Self-Update Guard Test',
  '2026-07-20 08:00:00+02'::timestamptz,
  '2026-07-20 18:00:00+02'::timestamptz,
  'single',
  'Confirmado'
)
ON CONFLICT (id) DO UPDATE
SET title = excluded.title;

INSERT INTO public.job_assignments (
  id, job_id, technician_id, status, sound_role, use_tour_multipliers, assignment_source
) VALUES (
  'c9300000-0000-0000-0000-000000000001'::uuid,
  'c9200000-0000-0000-0000-000000000001'::uuid,
  'c9100000-0000-0000-0000-000000000002'::uuid,
  'invited', 'FOH-A', false, 'direct'
)
ON CONFLICT (id) DO UPDATE
SET status = excluded.status,
    sound_role = excluded.sound_role,
    use_tour_multipliers = excluded.use_tour_multipliers;

-- ---------------------------------------------------------------------------
-- As the assigned technician
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'c9100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

-- Allowed: accept the assignment (status + response_time only).
SELECT lives_ok(
  $$
    UPDATE public.job_assignments
    SET status = 'confirmed', response_time = now()
    WHERE id = 'c9300000-0000-0000-0000-000000000001'::uuid
  $$,
  'a technician may accept their own assignment (status/response_time)'
);

-- Blocked: self-assign a higher-paid role.
SELECT throws_ok(
  $$
    UPDATE public.job_assignments
    SET sound_role = 'FOH-RESP'
    WHERE id = 'c9300000-0000-0000-0000-000000000001'::uuid
  $$,
  '42501',
  NULL,
  'a technician cannot change their own role on their assignment'
);

-- Blocked: force tour multipliers on to inflate payout.
SELECT throws_ok(
  $$
    UPDATE public.job_assignments
    SET use_tour_multipliers = true
    WHERE id = 'c9300000-0000-0000-0000-000000000001'::uuid
  $$,
  '42501',
  NULL,
  'a technician cannot force tour multipliers on their assignment'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT * FROM finish();
