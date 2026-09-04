-- SEC-13: the ICS token is a bearer credential for tech-calendar-ics. It must
-- not be readable from the broadly-readable `profiles` row, and one user must
-- not be able to read another user's token.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(11);

-- --- structure -------------------------------------------------------------

SELECT hasnt_column(
  'public', 'profiles', 'calendar_ics_token',
  'the ICS token no longer lives on the broadly-readable profiles row'
);

SELECT has_table(
  'public', 'profile_calendar_tokens',
  'tokens live in their own table'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profile_calendar_tokens'),
  'RLS is enabled on profile_calendar_tokens'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_calendar_tokens'
      AND 'authenticated' = ANY (roles) AND cmd <> 'SELECT'),
  0,
  'authenticated has no write policy: rotation goes through the definer RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'profile_calendar_tokens'
       AND policyname = 'profile_calendar_tokens_select_own'
       AND qual ILIKE '%auth.uid()%'
       AND qual ILIKE '%profile_id%'
  ),
  'the read policy correlates the row to the calling user'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.profile_calendar_tokens', 'SELECT'),
  'anon cannot read the token table at all'
);

-- --- behaviour: one user must not see another user's token ------------------

-- profiles.id is FK-constrained to auth.users, so seed the auth rows first.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'c8100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sec13-a@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'c8100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sec13-b@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role)
VALUES
  ('c8100000-0000-0000-0000-000000000001', 'sec13-a@test.local', 'Ana',  'Uno', 'technician'),
  ('c8100000-0000-0000-0000-000000000002', 'sec13-b@test.local', 'Beto', 'Dos', 'technician')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_calendar_tokens (profile_id, token)
VALUES
  ('c8100000-0000-0000-0000-000000000001', 'token-belongs-to-ana'),
  ('c8100000-0000-0000-0000-000000000002', 'token-belongs-to-beto')
ON CONFLICT (profile_id) DO UPDATE SET token = EXCLUDED.token;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'c8100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.profile_calendar_tokens),
  1,
  'a technician sees exactly one token row'
);

SELECT is(
  (SELECT token FROM public.profile_calendar_tokens),
  'token-belongs-to-ana',
  'and it is their own'
);

SELECT is(
  (SELECT count(*)::integer FROM public.profile_calendar_tokens
    WHERE profile_id = 'c8100000-0000-0000-0000-000000000002'),
  0,
  'a colleague''s token is not readable even when addressed by id'
);

SELECT is(
  public.get_my_calendar_ics_token(),
  'token-belongs-to-ana',
  'the self-scoped RPC returns the caller''s own token'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'c8100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT is(
  public.get_my_calendar_ics_token(),
  'token-belongs-to-beto',
  'the RPC keys off the caller, not an argument'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT * FROM finish();
