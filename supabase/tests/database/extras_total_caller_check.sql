-- extras_total_for_job_tech() is SECURITY DEFINER: only admins/management, the
-- technician themself and server-side callers may read a technician's extras
-- (20261015212000).
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
BEGIN;
SELECT plan(6);

SELECT ok(
  NOT has_function_privilege('anon', 'public.extras_total_for_job_tech(uuid, uuid)', 'EXECUTE'),
  'anon cannot execute extras_total_for_job_tech'
);

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, email, 'test',
  now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('e7100000-0000-0000-0000-000000000001'::uuid, 'extras-guard-manager@test.local'),
  ('e7100000-0000-0000-0000-000000000002'::uuid, 'extras-guard-tech@test.local'),
  ('e7100000-0000-0000-0000-000000000003'::uuid, 'extras-guard-outsider@test.local')
) AS fixture(id, email);

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('e7100000-0000-0000-0000-000000000001', 'extras-guard-manager@test.local', 'Extras', 'Manager', 'management', 'sound'),
  ('e7100000-0000-0000-0000-000000000002', 'extras-guard-tech@test.local', 'Extras', 'Tech', 'technician', 'sound'),
  ('e7100000-0000-0000-0000-000000000003', 'extras-guard-outsider@test.local', 'Extras', 'Outsider', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;

SELECT isnt(
  public.extras_total_for_job_tech(gen_random_uuid(), 'e7100000-0000-0000-0000-000000000002'),
  NULL,
  'service_role callers get the breakdown'
);

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"e7100000-0000-0000-0000-000000000003"}', true);
SELECT is(
  public.extras_total_for_job_tech(gen_random_uuid(), 'e7100000-0000-0000-0000-000000000002'),
  NULL,
  'another technician gets nothing'
);

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"e7100000-0000-0000-0000-000000000002"}', true);
SELECT isnt(
  public.extras_total_for_job_tech(gen_random_uuid(), 'e7100000-0000-0000-0000-000000000002'),
  NULL,
  'a technician gets their own breakdown'
);

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"e7100000-0000-0000-0000-000000000001"}', true);
SELECT isnt(
  public.extras_total_for_job_tech(gen_random_uuid(), 'e7100000-0000-0000-0000-000000000002'),
  NULL,
  'management gets any technician''s breakdown'
);

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT is(
  public.extras_total_for_job_tech(gen_random_uuid(), 'e7100000-0000-0000-0000-000000000002'),
  NULL,
  'an anon JWT gets nothing even through an authenticated grant'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
