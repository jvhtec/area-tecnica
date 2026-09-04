-- SEC-13/SEC-16: private profile rows and commercial rate catalogs must be
-- enforced at the database boundary, including SECURITY DEFINER RPCs.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(16);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select'
      AND roles = ARRAY['authenticated']::name[]
      AND qual ILIKE '%auth.uid()%'
      AND qual ILIKE '%job_assignments%'
  ),
  'profile reads are authenticated and correlated to the caller'
);

SELECT ok(
  NOT (
    pg_get_function_result('public.get_profile_directory(uuid[])'::regprocedure)
      ILIKE ANY (ARRAY['%email%', '%phone%', '%dni%', '%residencia%', '%calendar_ics_token%'])
  ),
  'the directory RPC signature excludes private profile fields'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_profile_directory(uuid[])', 'EXECUTE'),
  'anonymous callers cannot enumerate the profile directory'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.get_profiles_with_skills()'::regprocedure
      AND prosecdef
      AND proconfig @> ARRAY['search_path=pg_catalog, public']
  ),
  'the privileged skills RPC pins its definer search path'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.rate_cards_2025', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.rate_cards_tour_2025', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.rate_extras_2025', 'SELECT'),
  'anonymous callers have no rate catalog grants'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('rate_cards_2025', 'rate_cards_tour_2025', 'rate_extras_2025')
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual ILIKE '%is_admin_or_management%'
  ),
  3,
  'all rate catalog reads require management at the policy boundary'
);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'c8200000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'visibility-a@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'c8200000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'visibility-b@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'c8200000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'visibility-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, dni, residencia, phone)
VALUES
  ('c8200000-0000-0000-0000-000000000001', 'visibility-a@test.local', 'Ada', 'One', 'technician', 'DNI-A', 'HOME-A', '600000001'),
  ('c8200000-0000-0000-0000-000000000002', 'visibility-b@test.local', 'Bea', 'Two', 'technician', 'DNI-B', 'HOME-B', '600000002'),
  ('c8200000-0000-0000-0000-000000000003', 'visibility-manager@test.local', 'Mara', 'Three', 'management', 'DNI-M', 'HOME-M', '600000003')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  dni = EXCLUDED.dni,
  residencia = EXCLUDED.residencia,
  phone = EXCLUDED.phone;

INSERT INTO public.rate_cards_2025 (
  category, base_day_eur, plus_10_12_eur, overtime_hour_eur
)
VALUES ('tecnico', 100, 120, 15)
ON CONFLICT (category) DO NOTHING;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'c8200000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.profiles
    WHERE id IN (
      'c8200000-0000-0000-0000-000000000001'::uuid,
      'c8200000-0000-0000-0000-000000000002'::uuid,
      'c8200000-0000-0000-0000-000000000003'::uuid
    )
  ),
  1,
  'a technician cannot enumerate unrelated private profiles'
);

SELECT is(
  (SELECT dni FROM public.profiles WHERE id = 'c8200000-0000-0000-0000-000000000002'),
  NULL,
  'addressing an unrelated technician by id does not reveal DNI'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.get_profile_directory(NULL)
    WHERE id IN (
      'c8200000-0000-0000-0000-000000000001'::uuid,
      'c8200000-0000-0000-0000-000000000002'::uuid,
      'c8200000-0000-0000-0000-000000000003'::uuid
    )
  ),
  3,
  'authenticated users can still resolve safe directory names'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_profiles_with_skills()$$,
  '42501',
  'permission denied',
  'a technician cannot bypass profile RLS through the skills RPC'
);

SELECT is(
  (SELECT count(*)::integer FROM public.rate_cards_2025),
  0,
  'a technician cannot read the commercial base-rate catalog'
);

RESET ROLE;

INSERT INTO public.jobs (id, title, start_time, end_time)
VALUES (
  'c8200000-0000-0000-0000-000000000010',
  'Visibility test job',
  now(),
  now() + interval '1 hour'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.job_assignments (job_id, technician_id)
VALUES
  ('c8200000-0000-0000-0000-000000000010', 'c8200000-0000-0000-0000-000000000001'),
  ('c8200000-0000-0000-0000-000000000010', 'c8200000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

SET ROLE authenticated;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.profiles
    WHERE id = 'c8200000-0000-0000-0000-000000000002'
  ),
  1,
  'technicians sharing a job can resolve each other for operational workflows'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.profiles
    WHERE id = 'c8200000-0000-0000-0000-000000000003'
  ),
  0,
  'sharing a job does not expose unrelated management profiles'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'c8200000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.profiles
    WHERE id IN (
      'c8200000-0000-0000-0000-000000000001'::uuid,
      'c8200000-0000-0000-0000-000000000002'::uuid,
      'c8200000-0000-0000-0000-000000000003'::uuid
    )
  ),
  3,
  'management retains the private profile access needed for staffing'
);

SELECT ok(
  (SELECT count(*) FROM public.rate_cards_2025 WHERE category = 'tecnico') >= 1,
  'management retains rate catalog access'
);

SELECT lives_ok(
  $$SELECT * FROM public.get_profiles_with_skills() LIMIT 1$$,
  'management retains access to the privileged skills projection'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT * FROM finish();
