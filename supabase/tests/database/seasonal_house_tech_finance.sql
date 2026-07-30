CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(25);

SELECT has_column('public', 'profiles', 'seasonal_house_tech', 'profiles stores the seasonal house-tech flag');
SELECT has_column('public', 'profiles', 'seasonal_house_tech_start_date', 'profiles stores the season start');
SELECT has_column('public', 'profiles', 'seasonal_house_tech_end_date', 'profiles stores the season end');
SELECT col_default_is('public', 'profiles', 'seasonal_house_tech', 'false', 'seasonal mode defaults off');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_seasonal_house_tech_range_check'
  ),
  'seasonal profiles require a valid inclusive date range'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_house_tech_autonomo_ignored_check'
  ),
  'house tech profiles cannot retain non-autonomo payroll state'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'enforce_seasonal_house_tech_change'
      AND NOT tgisinternal
  ),
  'seasonal profile changes have a dedicated privilege guard'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'recompute_timesheets_after_profile_finance_change'
      AND NOT tgisinternal
  ),
  'profile finance changes refresh existing active timesheets'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.enforce_seasonal_house_tech_change()', 'EXECUTE'),
  'authenticated callers cannot invoke the seasonal guard directly'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_profiles_with_skills()', 'EXECUTE'),
  'profile matrix RPC remains unavailable to anonymous callers'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'dc100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'seasonal-admin@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'dc100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'seasonal-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'dc100000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'seasonal-house@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'dc100000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'role-change-house@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id, email, first_name, last_name, role, department, autonomo,
  seasonal_house_tech, seasonal_house_tech_start_date, seasonal_house_tech_end_date
) VALUES
  (
    'dc100000-0000-0000-0000-000000000001'::uuid,
    'seasonal-admin@test.local', 'Seasonal', 'Admin', 'admin', 'sound', true,
    false, null, null
  ),
  (
    'dc100000-0000-0000-0000-000000000002'::uuid,
    'seasonal-manager@test.local', 'Seasonal', 'Manager', 'management', 'sound', true,
    false, null, null
  ),
  (
    'dc100000-0000-0000-0000-000000000003'::uuid,
    'seasonal-house@test.local', 'Seasonal', 'House', 'house_tech', 'sound', true,
    false, null, null
  ),
  (
    'dc100000-0000-0000-0000-000000000004'::uuid,
    'role-change-house@test.local', 'Role', 'Change', 'technician', 'sound', false,
    false, null, null
  )
ON CONFLICT (id) DO UPDATE SET
  email = excluded.email,
  role = excluded.role,
  department = excluded.department,
  autonomo = excluded.autonomo,
  seasonal_house_tech = excluded.seasonal_house_tech,
  seasonal_house_tech_start_date = excluded.seasonal_house_tech_start_date,
  seasonal_house_tech_end_date = excluded.seasonal_house_tech_end_date;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET seasonal_house_tech = true,
        seasonal_house_tech_start_date = '2026-06-01',
        seasonal_house_tech_end_date = '2026-08-31'
    WHERE id = 'dc100000-0000-0000-0000-000000000003'::uuid
  $$,
  '42501',
  'Only administrators may change seasonal house tech settings',
  'management cannot enable seasonal payroll'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$
    UPDATE public.profiles
    SET seasonal_house_tech = true,
        seasonal_house_tech_start_date = '2026-06-01',
        seasonal_house_tech_end_date = '2026-08-31'
    WHERE id = 'dc100000-0000-0000-0000-000000000003'::uuid
  $$,
  'admin can enable seasonal payroll with a valid range'
);

SELECT is(
  (
    SELECT seasonal_house_tech_start_date
    FROM public.profiles
    WHERE id = 'dc100000-0000-0000-0000-000000000003'::uuid
  ),
  '2026-06-01'::date,
  'the inclusive season start is stored'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);

UPDATE public.profiles
SET role = 'house_tech', autonomo = false
WHERE id = 'dc100000-0000-0000-0000-000000000004'::uuid;

SELECT is(
  (SELECT autonomo FROM public.profiles WHERE id = 'dc100000-0000-0000-0000-000000000004'::uuid),
  true,
  'changing a technician to house tech normalizes autonomo to true'
);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'Seasonal overtime-only test',
  '2026-07-10 08:00:00+02'::timestamptz,
  '2026-07-10 23:00:00+02'::timestamptz,
  'evento',
  'Confirmado'
)
ON CONFLICT (id) DO UPDATE SET job_type = excluded.job_type;

INSERT INTO public.custom_tech_rates (
  profile_id, base_day_eur, plus_10_12_eur, overtime_hour_eur,
  overtime_hour_responsable_eur
) VALUES (
  'dc100000-0000-0000-0000-000000000003'::uuid,
  200, 100, 15, 25
)
ON CONFLICT (profile_id) DO UPDATE SET
  base_day_eur = excluded.base_day_eur,
  plus_10_12_eur = excluded.plus_10_12_eur,
  overtime_hour_eur = excluded.overtime_hour_eur,
  overtime_hour_responsable_eur = excluded.overtime_hour_responsable_eur;

INSERT INTO public.timesheets (
  id, job_id, technician_id, date, start_time, end_time, break_minutes,
  category, is_active
) VALUES
  (
    'dc300000-0000-0000-0000-000000000001'::uuid,
    'dc200000-0000-0000-0000-000000000001'::uuid,
    'dc100000-0000-0000-0000-000000000003'::uuid,
    '2026-07-10', '08:00', '20:00', 0, 'responsable', true
  ),
  (
    'dc300000-0000-0000-0000-000000000002'::uuid,
    'dc200000-0000-0000-0000-000000000001'::uuid,
    'dc100000-0000-0000-0000-000000000003'::uuid,
    '2026-07-11', '08:00', '22:00', 0, 'responsable', true
  ),
  (
    'dc300000-0000-0000-0000-000000000003'::uuid,
    'dc200000-0000-0000-0000-000000000001'::uuid,
    'dc100000-0000-0000-0000-000000000003'::uuid,
    '2026-07-12', '08:00', '22:00', 0, 'responsable', true
  )
ON CONFLICT (id) DO UPDATE SET
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  category = excluded.category,
  is_active = true;

INSERT INTO public.job_date_types (job_id, date, type)
VALUES (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  '2026-07-12',
  'prep_day'
)
ON CONFLICT (job_id, date) DO UPDATE SET type = excluded.type;

UPDATE public.timesheets
SET updated_at = now()
WHERE id = 'dc300000-0000-0000-0000-000000000003'::uuid;

SELECT is(
  (public.compute_timesheet_amount_2025('dc300000-0000-0000-0000-000000000001'::uuid, true)->>'amount_eur')::numeric,
  0::numeric,
  'a 12-hour seasonal evento pays no base or plus'
);

SELECT is(
  (public.compute_timesheet_amount_2025('dc300000-0000-0000-0000-000000000002'::uuid, true)->>'amount_eur')::numeric,
  50::numeric,
  'a 14-hour seasonal shift pays two category-aware overtime hours only'
);

SELECT is(
  (
    SELECT amount_breakdown->>'rate_mode_source'
    FROM public.timesheets
    WHERE id = 'dc300000-0000-0000-0000-000000000002'::uuid
  ),
  'seasonal_house_tech_profile',
  'the stored audit breakdown identifies the profile-driven rate mode'
);

SELECT is(
  (
    SELECT amount_breakdown->>'seasonal_overtime_only'
    FROM public.timesheets
    WHERE id = 'dc300000-0000-0000-0000-000000000002'::uuid
  ),
  'true',
  'the stored audit breakdown marks overtime-only pricing'
);

SELECT is(
  (
    SELECT amount_eur
    FROM public.timesheets
    WHERE id = 'dc300000-0000-0000-0000-000000000003'::uuid
  ),
  50::numeric,
  'a seasonal prep day also pays only category-aware overtime above 12 hours'
);

SELECT is(
  (
    SELECT amount_breakdown->>'technician_rate_mode'
    FROM public.timesheets
    WHERE id = 'dc300000-0000-0000-0000-000000000003'::uuid
  ),
  'hourly',
  'the prep-day trigger preserves the seasonal hourly reporting mode'
);

UPDATE public.profiles
SET seasonal_house_tech = false,
    seasonal_house_tech_start_date = null,
    seasonal_house_tech_end_date = null
WHERE id = 'dc100000-0000-0000-0000-000000000003'::uuid;

SELECT is(
  (
    SELECT amount_eur
    FROM public.timesheets
    WHERE id = 'dc300000-0000-0000-0000-000000000002'::uuid
  ),
  300::numeric,
  'disabling seasonal mode automatically restores normal stored pricing'
);

UPDATE public.profiles
SET seasonal_house_tech = true,
    seasonal_house_tech_start_date = '2026-06-01',
    seasonal_house_tech_end_date = '2026-08-31'
WHERE id = 'dc100000-0000-0000-0000-000000000003'::uuid;

SELECT is(
  (
    SELECT amount_eur
    FROM public.timesheets
    WHERE id = 'dc300000-0000-0000-0000-000000000002'::uuid
  ),
  50::numeric,
  'enabling seasonal mode automatically removes stored base and plus amounts'
);

SELECT is(
  jsonb_array_length(
    public.check_technician_conflicts(
      'dc100000-0000-0000-0000-000000000003'::uuid,
      'dc200000-0000-0000-0000-000000000001'::uuid,
      '2026-09-01'::date
    )->'unavailabilityConflicts'
  ),
  1,
  'assignment conflict checks report dates after the configured season as unavailable'
);

SELECT is(
  jsonb_array_length(
    public.check_technician_conflicts(
      'dc100000-0000-0000-0000-000000000003'::uuid,
      'dc200000-0000-0000-0000-000000000001'::uuid,
      '2026-08-31'::date
    )->'unavailabilityConflicts'
  ),
  0,
  'assignment conflict checks treat the inclusive season end as available'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.get_profiles_with_skills()
    WHERE id = 'dc100000-0000-0000-0000-000000000003'
      AND seasonal_house_tech = true
      AND seasonal_house_tech_start_date = '2026-06-01'
      AND seasonal_house_tech_end_date = '2026-08-31'
  ),
  1,
  'the matrix profile RPC exposes the seasonal availability range'
);

SELECT * FROM finish();
