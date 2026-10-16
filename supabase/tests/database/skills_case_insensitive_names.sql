-- Skill names are unique regardless of case, the catalog is published to
-- realtime with its role mappings (20261016170000), and each department's
-- management can create skills in its own categories (and general) only.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(10);

SELECT is(
  (SELECT count(*) FROM (
    SELECT lower(name) FROM public.skills GROUP BY lower(name) HAVING count(*) > 1
  ) dupes),
  0::bigint,
  'no two skills share a name up to case'
);

INSERT INTO public.skills (name, category, active) VALUES ('pgtap skill', 'general', true);

SELECT throws_ok(
  $$INSERT INTO public.skills (name, category, active) VALUES ('PGTAP Skill', 'general', true)$$,
  '23505',
  NULL,
  'a skill that differs only in case is rejected'
);

SELECT has_index('public', 'skills', 'skills_name_lower_key', 'skills has the case-insensitive name index');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
  ),
  t || ' is published to supabase_realtime'
)
FROM unnest(ARRAY['skills', 'role_skill_mapping']) AS t;


-- Per-department creation through RLS.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT u.id, '00000000-0000-0000-0000-000000000000'::uuid, u.email, 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('e5100000-0000-0000-0000-000000000001'::uuid, 'skills-lights-manager@test.local'),
  ('e5100000-0000-0000-0000-000000000002'::uuid, 'skills-sound-tech@test.local')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('e5100000-0000-0000-0000-000000000001'::uuid, 'skills-lights-manager@test.local', 'Luz', 'Gestora', 'management', 'lights'),
  ('e5100000-0000-0000-0000-000000000002'::uuid, 'skills-sound-tech@test.local', 'Sonia', 'Técnica', 'technician', 'sound')
-- The auth.users trigger already created both profiles.
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"e5100000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$INSERT INTO public.skills (name, category, active) VALUES ('pgtap lights skill', 'lights-specialty', true)$$,
  'lights management creates a skill in a lights category'
);

SELECT lives_ok(
  $$INSERT INTO public.skills (name, category, active) VALUES ('pgtap general skill', 'general', true)$$,
  'lights management creates a general skill'
);

SELECT throws_ok(
  $$INSERT INTO public.skills (name, category, active) VALUES ('pgtap sound skill', 'sound', true)$$,
  '42501',
  NULL,
  'lights management cannot create a sound skill'
);

SELECT is(
  (SELECT count(*) FROM public.skills WHERE name IN ('pgtap lights skill', 'pgtap general skill') AND active),
  2::bigint,
  'the new skills are readable as active catalog entries'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'e5100000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"e5100000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$INSERT INTO public.skills (name, category, active) VALUES ('pgtap tech skill', 'sound', true)$$,
  '42501',
  NULL,
  'a technician cannot create skills'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
