CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(13);

SELECT has_table('public', 'job_producer_claims', 'job_producer_claims table exists');

SELECT col_is_pk(
  'public',
  'job_producer_claims',
  ARRAY['job_id', 'producer_id'],
  'one producer can claim a job only once'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.job_producer_claims'::regclass),
  'job_producer_claims has RLS enabled'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_producer_claims'
  ),
  3,
  'job_producer_claims has select, self-insert, and self-delete policies'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.job_producer_claims', 'SELECT')
    AND has_table_privilege('authenticated', 'public.job_producer_claims', 'INSERT')
    AND has_table_privilege('authenticated', 'public.job_producer_claims', 'DELETE')
    AND NOT has_table_privilege('authenticated', 'public.job_producer_claims', 'UPDATE')
    AND NOT has_table_privilege('anon', 'public.job_producer_claims', 'SELECT'),
  'Data API grants expose only authenticated select/insert/delete'
);

SELECT function_privs_are(
  'public',
  'get_job_producer_claims',
  ARRAY['uuid[]'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the safe producer directory function'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'd9100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-production-one@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'd9100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-production-two@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'd9100000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-sound@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, nickname, role, department)
VALUES
  ('d9100000-0000-0000-0000-000000000001'::uuid, 'claim-production-one@test.local', 'Ana', 'Ruiz', NULL, 'management', 'production'),
  ('d9100000-0000-0000-0000-000000000002'::uuid, 'claim-production-two@test.local', 'Luis', 'Pérez', 'Lucho', 'technician', 'producción'),
  ('d9100000-0000-0000-0000-000000000003'::uuid, 'claim-sound@test.local', 'Sara', 'Sonido', NULL, 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    nickname = excluded.nickname,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'Producer Claim Test Job',
  '2026-09-20 08:00:00+02'::timestamptz,
  '2026-09-20 20:00:00+02'::timestamptz,
  'single'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000001'::uuid,
      'd9100000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'a production user can claim a job for themself'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000001'::uuid,
      'd9100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '42501',
  NULL,
  'a production user cannot claim a job for another production user'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000001'::uuid,
      'd9100000-0000-0000-0000-000000000003'::uuid
    )
  $$,
  '23514',
  NULL,
  'a non-production profile cannot claim a job'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'authenticated viewers can see producer claims'
);

SELECT is(
  (
    SELECT display_name
    FROM public.get_job_producer_claims(
      ARRAY['d9200000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  'Ana Ruiz',
  'the safe directory function resolves the producer display name'
);

SELECT is_empty(
  $$
    DELETE FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
    RETURNING 1
  $$,
  'another user cannot release someone else''s claim'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$
    DELETE FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
      AND producer_id = 'd9100000-0000-0000-0000-000000000001'::uuid
  $$,
  'the claiming producer can release their own claim'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.job_producer_claims
WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.jobs WHERE id = 'd9200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id IN (
  'd9100000-0000-0000-0000-000000000001'::uuid,
  'd9100000-0000-0000-0000-000000000002'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'd9100000-0000-0000-0000-000000000001'::uuid,
  'd9100000-0000-0000-0000-000000000002'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid
);

SELECT * FROM finish();
