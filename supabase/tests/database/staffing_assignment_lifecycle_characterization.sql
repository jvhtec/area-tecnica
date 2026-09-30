\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(18);

SELECT ok(
  to_regprocedure('public.manage_assignment_lifecycle(uuid,uuid,text,text,uuid,jsonb)') IS NOT NULL,
  'manage_assignment_lifecycle exists'
);

SELECT ok(
  COALESCE((
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = to_regprocedure('public.manage_assignment_lifecycle(uuid,uuid,text,text,uuid,jsonb)')
  ), false),
  'manage_assignment_lifecycle remains SECURITY DEFINER'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'ca100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'phase1-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'phase1-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  (
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'phase1-manager@test.local',
    'Phase1',
    'Manager',
    'management',
    'sound'
  ),
  (
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'phase1-tech@test.local',
    'Phase1',
    'Tech',
    'technician',
    'sound'
  )
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('assignment.updated', 'Assignment updated', 'management', 'info', false),
  ('assignment.removed', 'Assignment removed', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES
  (
    'ca200000-0000-0000-0000-000000000001'::uuid,
    'Phase1 Confirm',
    '2026-10-10 08:00:00+02'::timestamptz,
    '2026-10-10 20:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  ),
  (
    'ca200000-0000-0000-0000-000000000002'::uuid,
    'Phase1 Conflict Target',
    '2026-10-11 08:00:00+02'::timestamptz,
    '2026-10-11 20:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  ),
  (
    'ca200000-0000-0000-0000-000000000003'::uuid,
    'Phase1 Existing Conflict',
    '2026-10-11 09:00:00+02'::timestamptz,
    '2026-10-11 18:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  ),
  (
    'ca200000-0000-0000-0000-000000000004'::uuid,
    'Phase1 Soft Decline',
    '2026-10-12 08:00:00+02'::timestamptz,
    '2026-10-12 20:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  ),
  (
    'ca200000-0000-0000-0000-000000000005'::uuid,
    'Phase1 Hard Cancel',
    '2026-10-13 08:00:00+02'::timestamptz,
    '2026-10-13 20:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  )
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    job_type = excluded.job_type,
    status = excluded.status;

INSERT INTO public.job_assignments (
  id,
  job_id,
  technician_id,
  assigned_by,
  status,
  sound_role,
  assignment_source
) VALUES
  (
    'ca300000-0000-0000-0000-000000000001'::uuid,
    'ca200000-0000-0000-0000-000000000001'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'invited',
    'FOH-RESP',
    'direct'
  ),
  (
    'ca300000-0000-0000-0000-000000000002'::uuid,
    'ca200000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'invited',
    'FOH-RESP',
    'direct'
  ),
  (
    'ca300000-0000-0000-0000-000000000003'::uuid,
    'ca200000-0000-0000-0000-000000000003'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'confirmed',
    'FOH-RESP',
    'direct'
  ),
  (
    'ca300000-0000-0000-0000-000000000004'::uuid,
    'ca200000-0000-0000-0000-000000000004'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'confirmed',
    'FOH-RESP',
    'direct'
  ),
  (
    'ca300000-0000-0000-0000-000000000005'::uuid,
    'ca200000-0000-0000-0000-000000000005'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000001'::uuid,
    'confirmed',
    'FOH-RESP',
    'direct'
  )
ON CONFLICT (id) DO UPDATE
SET status = excluded.status,
    sound_role = excluded.sound_role,
    assignment_source = excluded.assignment_source,
    response_time = NULL;

INSERT INTO public.timesheets (
  job_id,
  technician_id,
  date,
  category,
  is_active,
  source
) VALUES
  (
    'ca200000-0000-0000-0000-000000000001'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '2026-10-10',
    'responsable',
    true,
    'phase1-characterization'
  ),
  (
    'ca200000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '2026-10-11',
    'responsable',
    true,
    'phase1-characterization'
  ),
  (
    'ca200000-0000-0000-0000-000000000003'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '2026-10-11',
    'responsable',
    true,
    'phase1-characterization'
  ),
  (
    'ca200000-0000-0000-0000-000000000004'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '2026-10-12',
    'responsable',
    true,
    'phase1-characterization'
  ),
  (
    'ca200000-0000-0000-0000-000000000005'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    '2026-10-13',
    'responsable',
    true,
    'phase1-characterization'
  )
ON CONFLICT (job_id, technician_id, date) DO UPDATE
SET is_active = true,
    category = excluded.category,
    source = excluded.source;

CREATE TEMP TABLE phase1_lifecycle_results (
  scenario text PRIMARY KEY,
  result jsonb NOT NULL
);

INSERT INTO phase1_lifecycle_results (scenario, result)
VALUES (
  'confirm',
  public.manage_assignment_lifecycle(
    'ca200000-0000-0000-0000-000000000001'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'confirm',
    'soft',
    'ca100000-0000-0000-0000-000000000001'::uuid,
    '{"source":"phase1_characterization"}'::jsonb
  )
);

SELECT is(
  (SELECT result->>'success' FROM phase1_lifecycle_results WHERE scenario = 'confirm'),
  'true',
  'conflict-free confirm reports success'
);

SELECT is(
  (
    SELECT status::text
    FROM public.job_assignments
    WHERE id = 'ca300000-0000-0000-0000-000000000001'::uuid
  ),
  'confirmed',
  'confirm transitions invited assignment to confirmed'
);

SELECT ok(
  (
    SELECT response_time IS NOT NULL
    FROM public.job_assignments
    WHERE id = 'ca300000-0000-0000-0000-000000000001'::uuid
  ),
  'confirm records response_time'
);

INSERT INTO phase1_lifecycle_results (scenario, result)
VALUES (
  'conflict',
  public.manage_assignment_lifecycle(
    'ca200000-0000-0000-0000-000000000002'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'confirm',
    'soft',
    'ca100000-0000-0000-0000-000000000001'::uuid,
    '{"source":"phase1_characterization"}'::jsonb
  )
);

SELECT is(
  (SELECT result->>'error' FROM phase1_lifecycle_results WHERE scenario = 'conflict'),
  'conflict_detected',
  'confirm rejects a technician with another active timesheet on the target date'
);

SELECT is(
  (
    SELECT status::text
    FROM public.job_assignments
    WHERE id = 'ca300000-0000-0000-0000-000000000002'::uuid
  ),
  'invited',
  'conflict rejection leaves assignment status unchanged'
);

SELECT is(
  (
    SELECT is_active
    FROM public.timesheets
    WHERE job_id = 'ca200000-0000-0000-0000-000000000002'::uuid
      AND technician_id = 'ca100000-0000-0000-0000-000000000002'::uuid
      AND date = '2026-10-11'
  ),
  true,
  'conflict rejection leaves target timesheet active'
);

INSERT INTO phase1_lifecycle_results (scenario, result)
VALUES (
  'soft-decline',
  public.manage_assignment_lifecycle(
    'ca200000-0000-0000-0000-000000000004'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'decline',
    'soft',
    'ca100000-0000-0000-0000-000000000001'::uuid,
    '{"source":"phase1_characterization"}'::jsonb
  )
);

SELECT is(
  (SELECT result->>'success' FROM phase1_lifecycle_results WHERE scenario = 'soft-decline'),
  'true',
  'soft decline reports success'
);

SELECT is(
  (
    SELECT status::text
    FROM public.job_assignments
    WHERE id = 'ca300000-0000-0000-0000-000000000004'::uuid
  ),
  'declined',
  'soft decline retains the assignment row as declined'
);

SELECT is(
  (
    SELECT is_active
    FROM public.timesheets
    WHERE job_id = 'ca200000-0000-0000-0000-000000000004'::uuid
      AND technician_id = 'ca100000-0000-0000-0000-000000000002'::uuid
      AND date = '2026-10-12'
  ),
  false,
  'soft decline voids active timesheets rather than deleting them'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.assignment_audit_log
    WHERE assignment_id = 'ca300000-0000-0000-0000-000000000004'::uuid
      AND action = 'soft_deleted'
      AND new_status = 'declined'
  ),
  1,
  'soft decline records one lifecycle audit event'
);

INSERT INTO phase1_lifecycle_results (scenario, result)
VALUES (
  'hard-cancel',
  public.manage_assignment_lifecycle(
    'ca200000-0000-0000-0000-000000000005'::uuid,
    'ca100000-0000-0000-0000-000000000002'::uuid,
    'cancel',
    'hard',
    'ca100000-0000-0000-0000-000000000001'::uuid,
    '{"source":"phase1_characterization"}'::jsonb
  )
);

SELECT is(
  (SELECT result->>'success' FROM phase1_lifecycle_results WHERE scenario = 'hard-cancel'),
  'true',
  'hard cancel reports success'
);

SELECT is(
  (SELECT result->>'deleted_timesheets' FROM phase1_lifecycle_results WHERE scenario = 'hard-cancel'),
  '1',
  'hard cancel reports the deleted timesheet count'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.job_assignments
    WHERE id = 'ca300000-0000-0000-0000-000000000005'::uuid
  ),
  0,
  'hard cancel deletes the assignment row'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.timesheets
    WHERE job_id = 'ca200000-0000-0000-0000-000000000005'::uuid
      AND technician_id = 'ca100000-0000-0000-0000-000000000002'::uuid
  ),
  0,
  'hard cancel deletes the assignment timesheets'
);

SELECT is(
  (
    SELECT deleted_timesheet_count
    FROM public.assignment_audit_log
    WHERE assignment_id = 'ca300000-0000-0000-0000-000000000005'::uuid
      AND action = 'hard_deleted'
    ORDER BY created_at DESC
    LIMIT 1
  ),
  1,
  'hard cancel audit records the number of deleted timesheets'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.assignment_audit_log
    WHERE assignment_id = 'ca300000-0000-0000-0000-000000000001'::uuid
      AND action = 'confirmed'
      AND new_status = 'confirmed'
  ),
  1,
  'successful confirmation is written to the assignment audit log'
);

SELECT * FROM finish();
