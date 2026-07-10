CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(19);

SELECT ok(
  to_regprocedure('public.get_hourly_rate_mode_dates_for_timesheets(uuid[])') IS NOT NULL,
  'scoped hourly timesheet eligibility function exists'
);

SELECT ok(
  COALESCE((
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = to_regprocedure('public.get_hourly_rate_mode_dates_for_timesheets(uuid[])')
  ), false),
  'hourly eligibility function is security definer'
);

SELECT ok(
  COALESCE((
    SELECT provolatile = 's'
    FROM pg_proc
    WHERE oid = to_regprocedure('public.get_hourly_rate_mode_dates_for_timesheets(uuid[])')
  ), false),
  'hourly eligibility function is stable'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=public, pg_temp']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.get_hourly_rate_mode_dates_for_timesheets(uuid[])')
  ), false),
  'hourly eligibility function pins its search path'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_hourly_rate_mode_dates_for_timesheets(uuid[])',
    'EXECUTE'
  ),
  'authenticated callers can request scoped hourly eligibility rows'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_hourly_rate_mode_dates_for_timesheets(uuid[])',
    'EXECUTE'
  ),
  'anonymous callers cannot request hourly eligibility rows'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_technician_rate_mode_dates'
      AND policyname IN (
        'job_technician_rate_mode_dates_select_management',
        'job_technician_rate_mode_dates_select_own'
      )
  ),
  'source rate-mode table remains admin-only instead of exposing full rows'
);

SELECT ok(
  COALESCE((
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = to_regprocedure('public.ensure_hourly_rate_mode_timesheet()')
  ), false),
  'hourly timesheet invariant trigger function is security definer'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=public, pg_temp']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.ensure_hourly_rate_mode_timesheet()')
  ), false),
  'hourly timesheet invariant trigger function pins its search path'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.ensure_hourly_rate_mode_timesheet()',
    'EXECUTE'
  ),
  'authenticated callers cannot invoke the trigger function directly'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.job_technician_rate_mode_dates'::regclass
      AND tgname = 'trg_ensure_hourly_rate_mode_timesheet'
      AND NOT tgisinternal
  ),
  'hourly rate-mode writes are guarded by the timesheet invariant trigger'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'b8100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'hourly-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'b8100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'hourly-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'b8100000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'fixed-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'b8100000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'unrelated-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('b8100000-0000-0000-0000-000000000001'::uuid, 'hourly-manager@test.local', 'Hourly', 'Manager', 'management', 'sound'),
  ('b8100000-0000-0000-0000-000000000002'::uuid, 'hourly-tech@test.local', 'Hourly', 'Tech', 'technician', 'sound'),
  ('b8100000-0000-0000-0000-000000000003'::uuid, 'fixed-tech@test.local', 'Fixed', 'Tech', 'technician', 'lights'),
  ('b8100000-0000-0000-0000-000000000004'::uuid, 'unrelated-tech@test.local', 'Unrelated', 'Tech', 'technician', 'video')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('assignment.removed', 'Assignment removed', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES (
  'b8200000-0000-0000-0000-000000000001'::uuid,
  'Hourly Tour Date RLS Test',
  '2026-07-10 08:00:00+02'::timestamptz,
  '2026-07-11 02:00:00+02'::timestamptz,
  'tourdate',
  'Confirmado'
)
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    job_type = excluded.job_type,
    status = excluded.status;

INSERT INTO public.job_technician_rate_mode_dates (
  job_id, technician_id, date, use_rehearsal_rate, rate_mode, fixed_amount_eur
) VALUES
  (
    'b8200000-0000-0000-0000-000000000001'::uuid,
    'b8100000-0000-0000-0000-000000000002'::uuid,
    '2026-07-10', false, 'hourly', NULL
  ),
  (
    'b8200000-0000-0000-0000-000000000001'::uuid,
    'b8100000-0000-0000-0000-000000000003'::uuid,
    '2026-07-10', false, 'fixed', 250
  )
ON CONFLICT (job_id, technician_id, date) DO UPDATE
SET rate_mode = excluded.rate_mode,
    fixed_amount_eur = excluded.fixed_amount_eur,
    use_rehearsal_rate = excluded.use_rehearsal_rate;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.timesheets
    WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
      AND technician_id = 'b8100000-0000-0000-0000-000000000002'::uuid
      AND date = '2026-07-10'
      AND is_active
  ),
  1,
  'an hourly override creates its required active timesheet'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.timesheets
    WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
      AND technician_id = 'b8100000-0000-0000-0000-000000000003'::uuid
      AND date = '2026-07-10'
  ),
  0,
  'a fixed override does not create a timesheet'
);

UPDATE public.timesheets
SET is_active = false
WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
  AND technician_id = 'b8100000-0000-0000-0000-000000000002'::uuid
  AND date = '2026-07-10';

UPDATE public.job_technician_rate_mode_dates
SET rate_mode = 'hourly'
WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
  AND technician_id = 'b8100000-0000-0000-0000-000000000002'::uuid
  AND date = '2026-07-10';

SELECT is(
  (
    SELECT is_active
    FROM public.timesheets
    WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
      AND technician_id = 'b8100000-0000-0000-0000-000000000002'::uuid
      AND date = '2026-07-10'
  ),
  true,
  'writing an hourly override reactivates an existing soft-deleted timesheet'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'b8100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.get_hourly_rate_mode_dates_for_timesheets(
      ARRAY['b8200000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  1,
  'management can read hourly identifiers needed for approvals'
);

SELECT is_empty(
  $$
    SELECT technician_id
    FROM public.job_technician_rate_mode_dates
    WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
  $$,
  'management eligibility does not expose the admin-only source table'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'b8100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT is(
  ARRAY(
    SELECT technician_id
    FROM public.get_hourly_rate_mode_dates_for_timesheets(
      ARRAY['b8200000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  ARRAY['b8100000-0000-0000-0000-000000000002'::uuid],
  'a technician receives only their own hourly eligibility row'
);

SELECT is_empty(
  $$
    SELECT technician_id
    FROM public.job_technician_rate_mode_dates
    WHERE job_id = 'b8200000-0000-0000-0000-000000000001'::uuid
  $$,
  'technician eligibility does not expose the admin-only source table'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'b8100000-0000-0000-0000-000000000004', false);
SET ROLE authenticated;

SELECT is_empty(
  $$
    SELECT technician_id
    FROM public.get_hourly_rate_mode_dates_for_timesheets(
      ARRAY['b8200000-0000-0000-0000-000000000001'::uuid]
    )
  $$,
  'an unrelated technician receives no hourly eligibility rows'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.jobs
WHERE id = 'b8200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles
WHERE id IN (
  'b8100000-0000-0000-0000-000000000001'::uuid,
  'b8100000-0000-0000-0000-000000000002'::uuid,
  'b8100000-0000-0000-0000-000000000003'::uuid,
  'b8100000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM auth.users
WHERE id IN (
  'b8100000-0000-0000-0000-000000000001'::uuid,
  'b8100000-0000-0000-0000-000000000002'::uuid,
  'b8100000-0000-0000-0000-000000000003'::uuid,
  'b8100000-0000-0000-0000-000000000004'::uuid
);

SELECT * FROM finish();
