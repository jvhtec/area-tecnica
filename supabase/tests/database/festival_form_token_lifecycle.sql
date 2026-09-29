CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

BEGIN;

SELECT plan(10);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.festival_artists'::regclass
      AND tgname = 'trg_ensure_artist_form_for_missing_rider'
      AND NOT tgisinternal
  )
  AND to_regprocedure('public.ensure_artist_form_for_missing_rider()') IS NULL,
  'missing-rider changes no longer mint public form tokens automatically'
);

SELECT ok(
  to_regprocedure('public.get_or_create_festival_artist_form_for_send(uuid)') IS NOT NULL,
  'the explicit send-owned token RPC exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_or_create_festival_artist_form_for_send(uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.get_or_create_festival_artist_form_for_send(uuid)',
    'EXECUTE'
  ),
  'only authenticated callers can invoke the send-owned token RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_forms'
      AND indexname = 'festival_artist_forms_one_pending_per_artist_idx'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%WHERE (status = ''pending''%'
  ),
  'at most one pending form is enforced per artist'
);

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
  ('fb100000-0000-0000-0000-000000000001'::uuid, 'festival-form-manager@test.local'),
  ('fb100000-0000-0000-0000-000000000002'::uuid, 'festival-form-tech@test.local')
) AS fixture(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('fb100000-0000-0000-0000-000000000001'::uuid, 'festival-form-manager@test.local', 'Mara', 'Manager', 'management', 'production'),
  ('fb100000-0000-0000-0000-000000000002'::uuid, 'festival-form-tech@test.local', 'Toni', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('assignment.updated', 'Assignment updated', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES (
  'fb200000-0000-0000-0000-000000000001'::uuid,
  'Festival Form Lifecycle Test',
  '2031-07-10 08:00:00+02'::timestamptz,
  '2031-07-11 02:00:00+02'::timestamptz,
  'festival',
  'Confirmado'
);

INSERT INTO public.festival_artists (id, job_id, name, date, stage, rider_missing)
VALUES
  ('fb300000-0000-0000-0000-000000000001'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   'Artist With Missing Rider', '2031-07-10'::date, 1, true),
  ('fb300000-0000-0000-0000-000000000002'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   'Artist For Send', '2031-07-10'::date, 1, false);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.festival_artist_forms
    WHERE artist_id = 'fb300000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'creating an artist with rider_missing does not create a bearer token'
);

CREATE TEMP TABLE issued_festival_forms (
  sequence_number integer NOT NULL,
  form_id uuid NOT NULL,
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created boolean NOT NULL
);
GRANT SELECT, INSERT ON issued_festival_forms TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'fb100000-0000-0000-0000-000000000001', true);

INSERT INTO issued_festival_forms
SELECT 1, issued.form_id, issued.token, issued.expires_at, issued.created
FROM public.get_or_create_festival_artist_form_for_send(
  'fb300000-0000-0000-0000-000000000002'::uuid
) AS issued;

INSERT INTO issued_festival_forms
SELECT 2, issued.form_id, issued.token, issued.expires_at, issued.created
FROM public.get_or_create_festival_artist_form_for_send(
  'fb300000-0000-0000-0000-000000000002'::uuid
) AS issued;

SELECT is(
  (SELECT created FROM issued_festival_forms WHERE sequence_number = 1),
  true,
  'the first explicit send action creates a token'
);

SELECT is(
  (SELECT created FROM issued_festival_forms WHERE sequence_number = 2),
  false,
  'a repeated send action reuses the active token'
);

SELECT ok(
  (SELECT count(DISTINCT token) = 1 FROM issued_festival_forms)
  AND (
    SELECT count(*) = 1
    FROM public.festival_artist_forms
    WHERE artist_id = 'fb300000-0000-0000-0000-000000000002'::uuid
      AND status = 'pending'::public.form_status
  ),
  'repeated send actions leave exactly one pending credential'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_or_create_festival_artist_form_for_send(NULL::uuid)$$,
  '22023',
  'artist id is required',
  'the send RPC rejects a missing artist id'
);

SELECT set_config('request.jwt.claim.sub', 'fb100000-0000-0000-0000-000000000002', true);

SELECT throws_ok(
  $$SELECT * FROM public.get_or_create_festival_artist_form_for_send('fb300000-0000-0000-0000-000000000002'::uuid)$$,
  'P0002',
  'artist not found or inaccessible',
  'a technician cannot issue a public form token'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
