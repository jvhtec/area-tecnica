CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

BEGIN;

SELECT plan(43);

-- Structural contract
SELECT ok(
  to_regprocedure('public.copy_festival_shifts(uuid,date,date)') IS NOT NULL,
  'the transactional festival shift copy RPC exists'
);
SELECT ok(
  (
    SELECT is_nullable = 'NO'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_shift_assignments'
      AND column_name = 'shift_id'
  ),
  'festival shift assignments require a shift'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_record
    WHERE constraint_record.conname = 'festival_shift_assignments_technician_id_fkey'
      AND constraint_record.confrelid = 'public.profiles'::regclass
  ),
  'internal shift crew reference profiles'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'festival_shift_assignments_shift_technician_unique'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%WHERE (technician_id IS NOT NULL)%'
  ),
  'internal crew are unique per shift'
);
SELECT ok(
  (
    SELECT count(*) = 4
    FROM pg_trigger
    WHERE tgname IN (
      'trg_validate_festival_shift_assignment_membership',
      'trg_validate_festival_shift_job_change',
      'trg_cleanup_festival_shift_membership_delete',
      'trg_cleanup_festival_shift_membership_update'
    )
      AND tgenabled <> 'D'
  ),
  'membership is enforced from shifts and job assignments'
);
SELECT ok(
  pg_get_functiondef(
    'public.validate_festival_shift_assignment_membership()'::regprocedure
  ) ILIKE '%pg_advisory_xact_lock%'
  AND pg_get_functiondef(
    'public.validate_festival_shift_job_change()'::regprocedure
  ) ILIKE '%pg_advisory_xact_lock%'
  AND pg_get_functiondef(
    'public.cleanup_festival_shift_membership_on_job_assignment()'::regprocedure
  ) ILIKE '%pg_advisory_xact_lock%'
  AND pg_get_functiondef(
    'public.copy_festival_shifts(uuid,date,date)'::regprocedure
  ) ILIKE '%pg_advisory_xact_lock%',
  'membership checks serialize concurrent writes to the same job technician pair'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.copy_festival_shifts(uuid,date,date)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.copy_festival_shifts(uuid,date,date)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.copy_festival_shifts(uuid,date,date)', 'EXECUTE'),
  'only authenticated and service callers can invoke the shift copy RPC'
);
SELECT ok(
  (
    SELECT NOT procedure_record.prosecdef
      AND array_to_string(procedure_record.proconfig, ',') LIKE '%search_path=%'
    FROM pg_proc AS procedure_record
    WHERE procedure_record.oid = 'public.copy_festival_shifts(uuid,date,date)'::regprocedure
  ),
  'the copy RPC is security invoker with a pinned search path'
);

-- Fixtures
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
  ('fb100000-0000-0000-0000-000000000001'::uuid, 'fest-shift-admin@test.local'),
  ('fb100000-0000-0000-0000-000000000002'::uuid, 'fest-shift-assigned@test.local'),
  ('fb100000-0000-0000-0000-000000000003'::uuid, 'fest-shift-unassigned@test.local'),
  ('fb100000-0000-0000-0000-000000000004'::uuid, 'fest-shift-declined@test.local'),
  ('fb100000-0000-0000-0000-000000000005'::uuid, 'fest-shift-invited@test.local'),
  ('fb100000-0000-0000-0000-000000000006'::uuid, 'fest-shift-other-job@test.local')
) AS fixture(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('fb100000-0000-0000-0000-000000000001'::uuid, 'fest-shift-admin@test.local', 'Ada', 'Admin', 'admin', 'production'),
  ('fb100000-0000-0000-0000-000000000002'::uuid, 'fest-shift-assigned@test.local', 'Sonia', 'Asignada', 'technician', 'sound'),
  ('fb100000-0000-0000-0000-000000000003'::uuid, 'fest-shift-unassigned@test.local', 'Una', 'Sin trabajo', 'technician', 'sound'),
  ('fb100000-0000-0000-0000-000000000004'::uuid, 'fest-shift-declined@test.local', 'Dina', 'Declinada', 'technician', 'sound'),
  ('fb100000-0000-0000-0000-000000000005'::uuid, 'fest-shift-invited@test.local', 'Inés', 'Invitada', 'technician', 'lights'),
  ('fb100000-0000-0000-0000-000000000006'::uuid, 'fest-shift-other-job@test.local', 'Olga', 'Otro trabajo', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('assignment.updated', 'Assignment updated', 'management', 'info', false),
  ('assignment.removed', 'Assignment removed', 'management', 'info', false),
  ('assignment.deleted', 'Assignment deleted', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES
  ('fb200000-0000-0000-0000-000000000001'::uuid, 'Festival Shift Integrity',
   '2032-07-10 08:00:00+02'::timestamptz, '2032-07-14 02:00:00+02'::timestamptz, 'festival', 'Confirmado'),
  ('fb200000-0000-0000-0000-000000000002'::uuid, 'Other Festival Job',
   '2032-07-10 08:00:00+02'::timestamptz, '2032-07-14 02:00:00+02'::timestamptz, 'festival', 'Confirmado');

INSERT INTO public.job_assignments (
  id, job_id, technician_id, status, sound_role, lights_role,
  use_tour_multipliers, assignment_source
)
VALUES
  ('fb300000-0000-0000-0000-000000000001'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   'fb100000-0000-0000-0000-000000000002'::uuid, 'confirmed', 'SND-TECH-A', NULL, false, 'direct'),
  ('fb300000-0000-0000-0000-000000000002'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   'fb100000-0000-0000-0000-000000000004'::uuid, 'declined', 'SND-TECH-A', NULL, false, 'direct'),
  ('fb300000-0000-0000-0000-000000000003'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   'fb100000-0000-0000-0000-000000000005'::uuid, 'invited', NULL, 'LGT-BRD-E', false, 'staffing'),
  ('fb300000-0000-0000-0000-000000000004'::uuid, 'fb200000-0000-0000-0000-000000000002'::uuid,
   'fb100000-0000-0000-0000-000000000006'::uuid, 'confirmed', 'SND-TECH-A', NULL, false, 'direct');

INSERT INTO public.festival_shifts (
  id, job_id, date, start_time, end_time, name, stage, department, notes
)
VALUES
  ('fb400000-0000-0000-0000-000000000001'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   '2032-07-10'::date, '09:00'::time, '17:00'::time, 'Sonido día', 1, 'sound', 'Keep this note'),
  ('fb400000-0000-0000-0000-000000000002'::uuid, 'fb200000-0000-0000-0000-000000000001'::uuid,
   '2032-07-10'::date, '18:00'::time, '02:00'::time, 'Noche', 2, 'lights', NULL);

-- Assignment integrity
SELECT lives_ok(
  $$INSERT INTO public.festival_shift_assignments (id, shift_id, technician_id, role)
    VALUES ('fb500000-0000-0000-0000-000000000001'::uuid,
      'fb400000-0000-0000-0000-000000000001'::uuid,
      'fb100000-0000-0000-0000-000000000002'::uuid, 'SND-TECH-A')$$,
  'a confirmed job technician can be assigned to a shift'
);
SELECT lives_ok(
  $$INSERT INTO public.festival_shift_assignments (id, shift_id, technician_id, role)
    VALUES ('fb500000-0000-0000-0000-000000000003'::uuid,
      'fb400000-0000-0000-0000-000000000002'::uuid,
      'fb100000-0000-0000-0000-000000000005'::uuid, 'LGT-BRD-E')$$,
  'an invited staffing technician belongs to the job and can be assigned'
);
SELECT lives_ok(
  $$INSERT INTO public.festival_shift_assignments (id, shift_id, external_technician_name, role)
    VALUES ('fb500000-0000-0000-0000-000000000002'::uuid,
      'fb400000-0000-0000-0000-000000000002'::uuid, 'Técnico externo', 'lights')$$,
  'external crew do not require a job assignment'
);
SELECT throws_ok(
  $$INSERT INTO public.festival_shift_assignments (shift_id, technician_id, role)
    VALUES ('fb400000-0000-0000-0000-000000000001'::uuid,
      'fb100000-0000-0000-0000-000000000002'::uuid, 'duplicate')$$,
  '23505', NULL, 'an internal technician cannot be added to the same shift twice'
);
SELECT throws_ok(
  $$INSERT INTO public.festival_shift_assignments (technician_id, role)
    VALUES ('fb100000-0000-0000-0000-000000000002'::uuid, 'orphan')$$,
  '23514', NULL, 'an assignment cannot exist without a shift'
);
SELECT throws_ok(
  $$INSERT INTO public.festival_shift_assignments (external_technician_name, role)
    VALUES ('Técnico sin turno', 'external')$$,
  '23502', NULL, 'external crew also require a shift'
);
SELECT throws_ok(
  $$INSERT INTO public.festival_shift_assignments (shift_id, technician_id, role)
    VALUES ('fb400000-0000-0000-0000-000000000001'::uuid,
      'fb100000-0000-0000-0000-000000000003'::uuid, 'not-on-job')$$,
  '23514', NULL, 'a technician who is not on the job is rejected'
);
SELECT lives_ok(
  $$INSERT INTO public.festival_shift_assignments (shift_id, technician_id, role)
    VALUES ('fb400000-0000-0000-0000-000000000001'::uuid,
      'fb100000-0000-0000-0000-000000000004'::uuid, 'declined')$$,
  'a declined assignment still establishes job membership'
);
SELECT lives_ok(
  $$DELETE FROM public.profiles
    WHERE id = 'fb100000-0000-0000-0000-000000000004'::uuid$$,
  'deleting a profile can cascade its job and shift memberships'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.job_assignments
    WHERE technician_id = 'fb100000-0000-0000-0000-000000000004'::uuid
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.festival_shift_assignments
    WHERE technician_id = 'fb100000-0000-0000-0000-000000000004'::uuid
  ),
  'profile deletion leaves no job or festival-shift membership behind'
);
SELECT throws_ok(
  $$INSERT INTO public.festival_shift_assignments (shift_id, technician_id, role)
    VALUES ('fb400000-0000-0000-0000-000000000001'::uuid,
      'fb100000-0000-0000-0000-000000000006'::uuid, 'other-job')$$,
  '23514', NULL, 'a technician assigned only to another job is rejected'
);
SELECT throws_ok(
  $$UPDATE public.festival_shift_assignments
    SET technician_id = 'fb100000-0000-0000-0000-000000000003'::uuid
    WHERE id = 'fb500000-0000-0000-0000-000000000001'::uuid$$,
  '23514', NULL, 'an existing shift assignment cannot be moved to a non-member'
);
SELECT throws_ok(
  $$UPDATE public.festival_shifts
    SET job_id = 'fb200000-0000-0000-0000-000000000002'::uuid
    WHERE id = 'fb400000-0000-0000-0000-000000000001'::uuid$$,
  '23514', NULL, 'a shift cannot move to a job that does not contain its internal crew'
);
SELECT throws_ok(
  $$UPDATE public.festival_shifts
    SET job_id = NULL
    WHERE id = 'fb400000-0000-0000-0000-000000000001'::uuid$$,
  '23514', NULL, 'a shift with internal crew cannot be detached from its job'
);
SELECT lives_ok(
  $$DELETE FROM public.job_assignments
    WHERE id = 'fb300000-0000-0000-0000-000000000003'::uuid$$,
  'deleting a job assignment automatically unschedules the technician'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.festival_shift_assignments
    WHERE technician_id = 'fb100000-0000-0000-0000-000000000005'::uuid
  ),
  'job-assignment deletion leaves no orphaned festival shift crew'
);

-- Atomic copy behaviour
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'fb100000-0000-0000-0000-000000000001', true);

SELECT is(
  public.get_current_user_role(),
  'admin',
  'the RPC test caller resolves to the admin role'
);

SELECT results_eq(
  $$SELECT * FROM public.copy_festival_shifts(
      'fb200000-0000-0000-0000-000000000001'::uuid,
      '2032-07-10'::date, '2032-07-11'::date)$$,
  $$VALUES (2, 2)$$,
  'the RPC reports every copied shift and assignment'
);
SELECT is(
  (SELECT count(*)::integer FROM public.festival_shifts
   WHERE job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
     AND date = '2032-07-11'::date),
  2,
  'the target day receives every source shift'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.festival_shift_assignments AS assignment
   JOIN public.festival_shifts AS shift ON shift.id = assignment.shift_id
   WHERE shift.job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
     AND shift.date = '2032-07-11'::date),
  2,
  'the target shifts receive internal and external crew'
);
SELECT results_eq(
  $$SELECT name, start_time, end_time, stage, department, notes
    FROM public.festival_shifts
    WHERE job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
      AND date = '2032-07-11'::date
    ORDER BY start_time$$,
  $$VALUES
      ('Sonido día'::text, '09:00'::time, '17:00'::time, 1, 'sound'::text, 'Keep this note'::text),
      ('Noche'::text, '18:00'::time, '02:00'::time, 2, 'lights'::text, NULL::text)$$,
  'the copy preserves all editable shift fields'
);
SELECT throws_ok(
  $$SELECT public.copy_festival_shifts(
      'fb200000-0000-0000-0000-000000000001'::uuid,
      '2032-07-10'::date, '2032-07-11'::date)$$,
  '23505', NULL, 'retrying against a populated target is rejected instead of duplicating it'
);
SELECT is(
  (SELECT count(*)::integer FROM public.festival_shifts
   WHERE job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
     AND date = '2032-07-11'::date),
  2,
  'a rejected retry leaves the completed copy unchanged'
);
SELECT throws_ok(
  $$SELECT public.copy_festival_shifts(
      'fb200000-0000-0000-0000-000000000001'::uuid,
      '2032-07-09'::date, '2032-07-12'::date)$$,
  'P0002', NULL, 'an empty source day is rejected'
);
SELECT throws_ok(
  $$SELECT public.copy_festival_shifts(
      'fb200000-0000-0000-0000-000000000001'::uuid,
      '2032-07-10'::date, '2032-07-10'::date)$$,
  '22023', NULL, 'source and target dates must differ'
);
SELECT throws_ok(
  $$SELECT public.copy_festival_shifts(
      NULL::uuid, '2032-07-10'::date, '2032-07-12'::date)$$,
  '22004', NULL, 'all copy parameters are required'
);
SELECT throws_ok(
  $$SELECT public.copy_festival_shifts(
      'fb200000-0000-0000-0000-000000000099'::uuid,
      '2032-07-10'::date, '2032-07-12'::date)$$,
  'P0002', NULL, 'a missing job is rejected'
);

SELECT set_config('request.jwt.claim.sub', 'fb100000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$SELECT public.copy_festival_shifts(
      'fb200000-0000-0000-0000-000000000001'::uuid,
      '2032-07-10'::date, '2032-07-13'::date)$$,
  '42501', NULL, 'a technician cannot use the RPC to create shifts'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', 'fb100000-0000-0000-0000-000000000001', true);
SELECT is(
  (SELECT count(*)::integer FROM public.festival_shifts
   WHERE job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
     AND date = '2032-07-13'::date),
  0,
  'a rejected caller leaves no partial target copy'
);

SELECT lives_ok(
  $$UPDATE public.job_assignments
    SET status = 'declined'
    WHERE id = 'fb300000-0000-0000-0000-000000000001'::uuid$$,
  'assignment status changes do not remove job membership'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.festival_shift_assignments AS assignment
   JOIN public.festival_shifts AS shift ON shift.id = assignment.shift_id
   WHERE shift.job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
     AND assignment.technician_id = 'fb100000-0000-0000-0000-000000000002'::uuid),
  2,
  'declining preserves existing source and copied shift assignments'
);
SELECT lives_ok(
  $$UPDATE public.job_assignments
    SET job_id = 'fb200000-0000-0000-0000-000000000002'::uuid
    WHERE id = 'fb300000-0000-0000-0000-000000000001'::uuid$$,
  'moving a job assignment automatically unschedules the old job'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.festival_shift_assignments AS assignment
   JOIN public.festival_shifts AS shift ON shift.id = assignment.shift_id
   WHERE shift.job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
     AND assignment.technician_id = 'fb100000-0000-0000-0000-000000000002'::uuid),
  0,
  'moving membership leaves no shift crew orphaned on the old job'
);

SELECT lives_ok(
  $$DELETE FROM public.jobs
    WHERE id = 'fb200000-0000-0000-0000-000000000001'::uuid$$,
  'deleting the parent job can cascade all dependent festival data'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.job_assignments
    WHERE job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.festival_shifts
    WHERE job_id = 'fb200000-0000-0000-0000-000000000001'::uuid
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.festival_shift_assignments
    WHERE id IN (
      'fb500000-0000-0000-0000-000000000001'::uuid,
      'fb500000-0000-0000-0000-000000000002'::uuid
    )
  ),
  'the job cascade removes memberships, shifts, and shift assignments together'
);

SELECT * FROM finish();
ROLLBACK;
