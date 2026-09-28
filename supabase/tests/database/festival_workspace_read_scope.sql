CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

BEGIN;

SELECT plan(44);

-- ---------------------------------------------------------------------------
-- Structural assertions
-- ---------------------------------------------------------------------------

SELECT ok(
  to_regprocedure('public.can_read_festival_job(uuid)') IS NOT NULL
  AND to_regprocedure('public.can_read_festival_shift(uuid)') IS NOT NULL
  AND to_regprocedure('public.festival_department_matches(text,text)') IS NOT NULL,
  'festival read-scope helpers exist'
);

SELECT ok(
  (
    SELECT bool_and(proconfig @> ARRAY['search_path=pg_catalog, public']::text[])
    FROM pg_proc
    WHERE oid IN (
      to_regprocedure('public.can_read_festival_job(uuid)'),
      to_regprocedure('public.can_read_festival_shift(uuid)'),
      to_regprocedure('public.festival_department_matches(text,text)')
    )
  ),
  'festival read-scope helpers pin pg_catalog/public search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.can_read_festival_job(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.can_read_festival_shift(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.can_read_festival_job(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.can_read_festival_shift(uuid)', 'EXECUTE'),
  'festival read-scope helpers are callable by authenticated users only'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('SELECT', 'ALL')
      AND tablename IN (
        'festival_artist_forms', 'festival_artist_form_submissions',
        'festival_gear_setups', 'festival_stage_gear_setups', 'festival_settings',
        'festival_logos', 'festival_stages', 'festival_shifts', 'festival_shift_assignments'
      )
  ),
  9,
  'each scoped festival table has exactly one read policy'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND tablename IN (
        'festival_artist_forms', 'festival_artist_form_submissions',
        'festival_gear_setups', 'festival_stage_gear_setups', 'festival_settings',
        'festival_logos', 'festival_stages', 'festival_shifts', 'festival_shift_assignments'
      )
      AND roles <> ARRAY['authenticated']::name[]
  ),
  'festival read policies apply to authenticated only'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_forms'
      AND cmd = 'SELECT'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual NOT ILIKE '%technician%'
      AND qual NOT ILIKE '%house_tech%'
  ),
  'public form tokens are readable only by admin, management and logistics'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.festival_artist_forms', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_artist_form_submissions', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_shifts', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_shift_assignments', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_gear_setups', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_stage_gear_setups', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_settings', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_logos', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.festival_stages', 'SELECT'),
  'anonymous users have no direct read privilege on scoped festival tables'
);

SELECT ok(
  public.festival_department_matches('produccion', 'Producción')
  AND public.festival_department_matches('Sound', 'sound')
  AND NOT public.festival_department_matches('sound', 'lights')
  AND NOT public.festival_department_matches(NULL, 'sound'),
  'department matching normalizes case and production spellings'
);

-- ---------------------------------------------------------------------------
-- Fixtures (as the table owner; RLS does not apply)
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  u.id, '00000000-0000-0000-0000-000000000000'::uuid, u.email, 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('fa100000-0000-0000-0000-000000000001'::uuid, 'fest-scope-sound@test.local'),
  ('fa100000-0000-0000-0000-000000000002'::uuid, 'fest-scope-lights@test.local'),
  ('fa100000-0000-0000-0000-000000000003'::uuid, 'fest-scope-unassigned@test.local'),
  ('fa100000-0000-0000-0000-000000000004'::uuid, 'fest-scope-shift-only@test.local'),
  ('fa100000-0000-0000-0000-000000000005'::uuid, 'fest-scope-declined@test.local'),
  ('fa100000-0000-0000-0000-000000000006'::uuid, 'fest-scope-house@test.local'),
  ('fa100000-0000-0000-0000-000000000007'::uuid, 'fest-scope-logistics@test.local'),
  ('fa100000-0000-0000-0000-000000000008'::uuid, 'fest-scope-no-role@test.local')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('fa100000-0000-0000-0000-000000000001'::uuid, 'fest-scope-sound@test.local', 'Sonia', 'Sonido', 'technician', 'sound'),
  ('fa100000-0000-0000-0000-000000000002'::uuid, 'fest-scope-lights@test.local', 'Luis', 'Luces', 'technician', 'lights'),
  ('fa100000-0000-0000-0000-000000000003'::uuid, 'fest-scope-unassigned@test.local', 'Nadia', 'Nadie', 'technician', 'sound'),
  ('fa100000-0000-0000-0000-000000000004'::uuid, 'fest-scope-shift-only@test.local', 'Tomás', 'Turno', 'technician', 'sound'),
  ('fa100000-0000-0000-0000-000000000005'::uuid, 'fest-scope-declined@test.local', 'Diego', 'Declina', 'technician', 'sound'),
  ('fa100000-0000-0000-0000-000000000006'::uuid, 'fest-scope-house@test.local', 'Hugo', 'Casa', 'house_tech', 'sound'),
  ('fa100000-0000-0000-0000-000000000007'::uuid, 'fest-scope-logistics@test.local', 'Lola', 'Logística', 'logistics', 'logistics'),
  ('fa100000-0000-0000-0000-000000000008'::uuid, 'fest-scope-no-role@test.local', 'Rita', 'Rol', 'technician', 'lights')
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
  'fa200000-0000-0000-0000-000000000001'::uuid,
  'Festival Read Scope Test',
  '2031-07-10 08:00:00+02'::timestamptz,
  '2031-07-11 02:00:00+02'::timestamptz,
  'festival',
  'Confirmado'
);

INSERT INTO public.job_assignments (
  id, job_id, technician_id, status, sound_role, lights_role, use_tour_multipliers, assignment_source
) VALUES
  ('fa300000-0000-0000-0000-000000000001'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   'fa100000-0000-0000-0000-000000000001'::uuid, 'confirmed', 'FOH-A', NULL, false, 'direct'),
  ('fa300000-0000-0000-0000-000000000002'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   'fa100000-0000-0000-0000-000000000002'::uuid, 'invited', NULL, 'OP-L', false, 'direct'),
  ('fa300000-0000-0000-0000-000000000005'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   'fa100000-0000-0000-0000-000000000005'::uuid, 'declined', 'FOH-A', NULL, false, 'direct'),
  ('fa300000-0000-0000-0000-000000000008'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   'fa100000-0000-0000-0000-000000000008'::uuid, 'confirmed', NULL, NULL, false, 'direct');

INSERT INTO public.festival_shifts (id, job_id, date, start_time, end_time, name, stage, department)
VALUES
  ('fa400000-0000-0000-0000-000000000001'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   '2031-07-10'::date, '09:00'::time, '13:00'::time, 'Sonido mañana', 1, 'sound'),
  ('fa400000-0000-0000-0000-000000000002'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   '2031-07-10'::date, '14:00'::time, '18:00'::time, 'Luces tarde', 1, 'lights'),
  ('fa400000-0000-0000-0000-000000000003'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
   '2031-07-10'::date, '08:00'::time, '09:00'::time, 'Briefing general', 1, NULL);

-- The shift-only technician has no job_assignments row, only this shift.
INSERT INTO public.festival_shift_assignments (id, shift_id, technician_id, role, external_technician_name)
VALUES
  ('fa500000-0000-0000-0000-000000000001'::uuid, 'fa400000-0000-0000-0000-000000000002'::uuid,
   'fa100000-0000-0000-0000-000000000004'::uuid, 'refuerzo', NULL),
  ('fa500000-0000-0000-0000-000000000002'::uuid, 'fa400000-0000-0000-0000-000000000001'::uuid,
   NULL, 'external', 'Técnico externo');

INSERT INTO public.festival_artists (id, job_id, name, date, stage, rider_missing)
VALUES ('fa600000-0000-0000-0000-000000000001'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid,
        'Artista Scope', '2031-07-10'::date, 1, false);

INSERT INTO public.festival_artist_forms (id, artist_id, token, expires_at)
VALUES ('fa700000-0000-0000-0000-000000000001'::uuid, 'fa600000-0000-0000-0000-000000000001'::uuid,
        'fa710000-0000-0000-0000-000000000001'::uuid, now() + interval '7 days');

INSERT INTO public.festival_artist_form_submissions (id, form_id, artist_id, form_data)
VALUES ('fa800000-0000-0000-0000-000000000001'::uuid, 'fa700000-0000-0000-0000-000000000001'::uuid,
        'fa600000-0000-0000-0000-000000000001'::uuid, '{}'::jsonb);

INSERT INTO public.festival_gear_setups (id, job_id, max_stages)
VALUES ('fa900000-0000-0000-0000-000000000001'::uuid, 'fa200000-0000-0000-0000-000000000001'::uuid, 1);

INSERT INTO public.festival_stage_gear_setups (id, gear_setup_id, stage_number)
VALUES ('fa910000-0000-0000-0000-000000000001'::uuid, 'fa900000-0000-0000-0000-000000000001'::uuid, 1);

INSERT INTO public.festival_settings (job_id, day_start_time)
VALUES ('fa200000-0000-0000-0000-000000000001'::uuid, '07:00');

INSERT INTO public.festival_logos (job_id, file_path, file_name)
VALUES ('fa200000-0000-0000-0000-000000000001'::uuid, 'fa200000/logo.png', 'logo.png');

INSERT INTO public.festival_stages (job_id, number, name)
VALUES ('fa200000-0000-0000-0000-000000000001'::uuid, 1, 'Principal');

-- Reusable reader: counts the rows of every scoped table for this job.
-- security_invoker makes RLS apply to the querying role, not the view owner.
-- Created inside the test transaction, so the ROLLBACK removes it.
CREATE VIEW public.__fest_scope_counts WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.festival_shifts WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid)::integer AS shifts,
  (SELECT count(*) FROM public.festival_shift_assignments
     WHERE id IN ('fa500000-0000-0000-0000-000000000001'::uuid, 'fa500000-0000-0000-0000-000000000002'::uuid))::integer AS shift_assignments,
  (SELECT count(*) FROM public.festival_artist_forms WHERE artist_id = 'fa600000-0000-0000-0000-000000000001'::uuid)::integer AS forms,
  (SELECT count(*) FROM public.festival_artist_form_submissions WHERE artist_id = 'fa600000-0000-0000-0000-000000000001'::uuid)::integer AS submissions,
  (SELECT count(*) FROM public.festival_gear_setups WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid)::integer AS gear,
  (SELECT count(*) FROM public.festival_stage_gear_setups WHERE gear_setup_id = 'fa900000-0000-0000-0000-000000000001'::uuid)::integer AS stage_gear,
  (SELECT count(*) FROM public.festival_settings WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid)::integer AS settings,
  (SELECT count(*) FROM public.festival_logos WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid)::integer AS logos,
  (SELECT count(*) FROM public.festival_stages WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid)::integer AS stages;

GRANT SELECT ON public.__fest_scope_counts TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- Sound technician assigned to the job
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000001', true);

SELECT results_eq(
  $$SELECT name FROM public.festival_shifts WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid ORDER BY name$$,
  $$VALUES ('Briefing general'::text), ('Sonido mañana'::text)$$,
  'sound tech sees sound and department-less shifts, not lights shifts'
);
SELECT is((SELECT shift_assignments FROM public.__fest_scope_counts), 1, 'sound tech sees crew only on visible shifts');
SELECT is((SELECT forms FROM public.__fest_scope_counts), 0, 'sound tech cannot read public form tokens');
SELECT is((SELECT submissions FROM public.__fest_scope_counts), 1, 'sound tech keeps rider submission status for their job');
SELECT ok(
  (SELECT gear = 1 AND stage_gear = 1 AND settings = 1 AND logos = 1 AND stages = 1 FROM public.__fest_scope_counts),
  'sound tech reads job-level festival data for their job'
);

-- ---------------------------------------------------------------------------
-- Lights technician (invited, not yet confirmed) on the same job
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000002', true);

SELECT results_eq(
  $$SELECT name FROM public.festival_shifts WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid ORDER BY name$$,
  $$VALUES ('Briefing general'::text), ('Luces tarde'::text)$$,
  'lights tech sees lights and department-less shifts, not sound shifts'
);
SELECT is((SELECT shift_assignments FROM public.__fest_scope_counts), 1, 'lights tech sees crew on the lights shift only');
SELECT is((SELECT forms FROM public.__fest_scope_counts), 0, 'lights tech cannot read public form tokens');

-- ---------------------------------------------------------------------------
-- Technician assigned with no department role falls back to profile department
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000008', true);

SELECT results_eq(
  $$SELECT name FROM public.festival_shifts WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid ORDER BY name$$,
  $$VALUES ('Briefing general'::text), ('Luces tarde'::text)$$,
  'assignment without a role falls back to the profile department'
);

-- ---------------------------------------------------------------------------
-- Technician on a shift but with no job assignment
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000004', true);

SELECT results_eq(
  $$SELECT name FROM public.festival_shifts WHERE job_id = 'fa200000-0000-0000-0000-000000000001'::uuid ORDER BY name$$,
  $$VALUES ('Luces tarde'::text)$$,
  'shift-only tech sees the shift they are on, even outside their profile department'
);
SELECT is((SELECT shift_assignments FROM public.__fest_scope_counts), 1, 'shift-only tech sees their own shift assignment');
SELECT ok(
  (SELECT gear = 1 AND settings = 1 AND stages = 1 AND logos = 1 FROM public.__fest_scope_counts),
  'shift-only tech reads job-level festival data for that job'
);
SELECT is((SELECT forms FROM public.__fest_scope_counts), 0, 'shift-only tech cannot read public form tokens');

-- ---------------------------------------------------------------------------
-- Unassigned technician
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000003', true);

SELECT is((SELECT shifts FROM public.__fest_scope_counts), 0, 'unassigned tech sees no shifts');
SELECT is((SELECT shift_assignments FROM public.__fest_scope_counts), 0, 'unassigned tech sees no shift crew');
SELECT is((SELECT forms FROM public.__fest_scope_counts), 0, 'unassigned tech sees no form tokens');
SELECT is((SELECT submissions FROM public.__fest_scope_counts), 0, 'unassigned tech sees no form submissions');
SELECT is((SELECT gear FROM public.__fest_scope_counts), 0, 'unassigned tech sees no gear setup');
SELECT is((SELECT stage_gear FROM public.__fest_scope_counts), 0, 'unassigned tech sees no stage gear setup');
SELECT is((SELECT settings FROM public.__fest_scope_counts), 0, 'unassigned tech sees no festival settings');
SELECT is((SELECT logos FROM public.__fest_scope_counts), 0, 'unassigned tech sees no festival logo');
SELECT is((SELECT stages FROM public.__fest_scope_counts), 0, 'unassigned tech sees no festival stages');

-- ---------------------------------------------------------------------------
-- Technician who declined the job
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000005', true);

SELECT is((SELECT shifts FROM public.__fest_scope_counts), 0, 'declined tech sees no shifts');
SELECT is((SELECT gear FROM public.__fest_scope_counts), 0, 'declined tech sees no job-level festival data');

-- ---------------------------------------------------------------------------
-- House tech (unassigned) keeps operational read, without form tokens
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000006', true);

SELECT is((SELECT shifts FROM public.__fest_scope_counts), 3, 'house tech sees every shift');
SELECT is((SELECT shift_assignments FROM public.__fest_scope_counts), 2, 'house tech sees every shift assignment');
SELECT is((SELECT forms FROM public.__fest_scope_counts), 0, 'house tech cannot read public form tokens');
SELECT is((SELECT submissions FROM public.__fest_scope_counts), 1, 'house tech reads form submissions');
SELECT ok(
  (SELECT gear = 1 AND stage_gear = 1 AND settings = 1 AND logos = 1 AND stages = 1 FROM public.__fest_scope_counts),
  'house tech reads job-level festival data'
);

-- ---------------------------------------------------------------------------
-- Logistics keeps full read, including form tokens (it may create them)
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000007', true);

SELECT is((SELECT shifts FROM public.__fest_scope_counts), 3, 'logistics sees every shift');
SELECT is((SELECT forms FROM public.__fest_scope_counts), 1, 'logistics reads public form tokens');
SELECT is((SELECT submissions FROM public.__fest_scope_counts), 1, 'logistics reads form submissions');
SELECT ok(
  (SELECT gear = 1 AND stage_gear = 1 AND settings = 1 AND logos = 1 AND stages = 1 FROM public.__fest_scope_counts),
  'logistics reads job-level festival data'
);

-- ---------------------------------------------------------------------------
-- Helper edge cases
-- ---------------------------------------------------------------------------
SELECT ok(NOT public.can_read_festival_job(NULL), 'can_read_festival_job(NULL) is false');
SELECT ok(NOT public.can_read_festival_shift(NULL), 'can_read_festival_shift(NULL) is false');

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT ok(
  NOT public.can_read_festival_job('fa200000-0000-0000-0000-000000000001'::uuid),
  'a session with no user cannot read festival job data'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
