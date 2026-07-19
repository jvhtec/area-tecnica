CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(19);

SELECT has_column(
  'public',
  'profiles',
  'soundvision_tool_access_enabled',
  'profiles stores the NM/SV tool entitlement'
);

SELECT col_default_is(
  'public',
  'profiles',
  'soundvision_tool_access_enabled',
  'false',
  'the NM/SV tool entitlement defaults to false'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_soundvision_tool_access_sound_department_check'
      AND contype = 'c'
  ),
  'only sound department profiles may hold the entitlement'
);

SELECT ok(
  to_regprocedure('public.grant_soundvision_tool_access_from_responsable()') IS NOT NULL,
  'the responsable-assignment grant trigger function exists'
);

SELECT ok(
  COALESCE((
    SELECT prosecdef
      AND proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.grant_soundvision_tool_access_from_responsable()')
  ), false),
  'the grant function is a pinned security definer'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.job_assignments'::regclass
      AND tgname = 'grant_soundvision_tool_access_from_job_responsable'
      AND NOT tgisinternal
  ),
  'job responsable assignments grant the entitlement'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.tour_assignments'::regclass
      AND tgname = 'grant_soundvision_tool_access_from_tour_responsable'
      AND NOT tgisinternal
  ),
  'tour responsable assignments grant the entitlement'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'ca100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sv-tool-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sv-tool-tech-job@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'ca100000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sv-tool-tech-tour@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'ca100000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sv-tool-lights-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id, email, first_name, last_name, role, department, soundvision_tool_access_enabled
) VALUES
  (
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'sv-tool-manager@test.local', 'SV Tool', 'Manager', 'management', 'sound', false
  ),
  (
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'sv-tool-tech-job@test.local', 'SV Tool', 'Job Tech', 'technician', 'sound', false
  ),
  (
    'ca100000-0000-0000-0000-000000000003'::uuid,
    'sv-tool-tech-tour@test.local', 'SV Tool', 'Tour Tech', 'technician', 'sound', false
  ),
  (
    'ca100000-0000-0000-0000-000000000004'::uuid,
    'sv-tool-lights-tech@test.local', 'SV Tool', 'Lights Tech', 'technician', 'lights', false
  )
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    role = excluded.role,
    department = excluded.department,
    soundvision_tool_access_enabled = false;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('assignment.updated', 'Assignment updated', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES (
  'ca200000-0000-0000-0000-000000000001'::uuid,
  'Soundvision Tool Entitlement Test',
  '2026-07-20 08:00:00+02'::timestamptz,
  '2026-07-20 18:00:00+02'::timestamptz,
  'single',
  'Confirmado'
)
ON CONFLICT (id) DO UPDATE SET title = excluded.title;

INSERT INTO public.job_assignments (
  id, job_id, technician_id, status, sound_role, assignment_source
) VALUES (
  'ca300000-0000-0000-0000-000000000001'::uuid,
  'ca200000-0000-0000-0000-000000000001'::uuid,
  'ca100000-0000-0000-0000-000000000002'::uuid,
  'invited', 'SND-FOH-T', 'direct'
)
ON CONFLICT (id) DO UPDATE
SET technician_id = excluded.technician_id,
    sound_role = excluded.sound_role,
    status = excluded.status;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  false,
  'a non-responsable sound assignment does not grant access'
);

UPDATE public.job_assignments
SET sound_role = 'SND-FOH-R'
WHERE id = 'ca300000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  true,
  'a responsable sound job assignment grants access'
);

UPDATE public.job_assignments
SET sound_role = 'SND-FOH-T'
WHERE id = 'ca300000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  true,
  'downgrading or removing the responsable role does not revoke access'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'ca100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$
    UPDATE public.profiles
    SET soundvision_tool_access_enabled = false
    WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid
  $$,
  'management can revoke the entitlement manually'
);

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  false,
  'the manual revocation is stored'
);

UPDATE public.job_assignments
SET status = 'confirmed'
WHERE id = 'ca300000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  false,
  'an unrelated assignment update does not undo a manual revocation'
);

UPDATE public.job_assignments
SET sound_role = 'SND-FOH-R'
WHERE id = 'ca300000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  true,
  'a later responsable assignment grants access again'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET soundvision_tool_access_enabled = true
    WHERE id = 'ca100000-0000-0000-0000-000000000004'::uuid
  $$,
  '23514',
  NULL,
  'a non-sound profile cannot receive the entitlement'
);

UPDATE public.profiles
SET department = 'lights'
WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000002'::uuid),
  false,
  'moving a user out of sound clears the entitlement'
);

INSERT INTO public.tours (id, name)
VALUES ('ca400000-0000-0000-0000-000000000001'::uuid, 'Soundvision Entitlement Tour')
ON CONFLICT (id) DO UPDATE SET name = excluded.name;

INSERT INTO public.tour_assignments (
  id, tour_id, technician_id, department, role
) VALUES (
  'ca500000-0000-0000-0000-000000000001'::uuid,
  'ca400000-0000-0000-0000-000000000001'::uuid,
  'ca100000-0000-0000-0000-000000000003'::uuid,
  'sound',
  'SND-SYS-R'
)
ON CONFLICT (id) DO UPDATE
SET technician_id = excluded.technician_id,
    department = excluded.department,
    role = excluded.role;

SELECT is(
  (SELECT soundvision_tool_access_enabled FROM public.profiles WHERE id = 'ca100000-0000-0000-0000-000000000003'::uuid),
  true,
  'a responsable sound tour assignment grants access'
);

UPDATE public.profiles
SET soundvision_tool_access_enabled = false
WHERE id = 'ca100000-0000-0000-0000-000000000003'::uuid;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'ca100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET soundvision_tool_access_enabled = true
    WHERE id = 'ca100000-0000-0000-0000-000000000003'::uuid
  $$,
  '42501',
  NULL,
  'a technician cannot self-enable the entitlement'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.grant_soundvision_tool_access_from_responsable()',
    'EXECUTE'
  ),
  'authenticated users cannot invoke the automatic grant function directly'
);

SELECT * FROM finish();
