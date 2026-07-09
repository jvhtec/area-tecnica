CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(13);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND policyname LIKE 'sub_rentals_%_scoped'
  ),
  4,
  'sub_rentals has one scoped policy for each CRUD operation'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND policyname LIKE 'p_sub_rentals_public_%'
  ),
  'legacy tautological sub_rentals policies are removed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND policyname = 'sub_rentals_select_scoped'
      AND qual ILIKE '%current_user_department%'
      AND qual ILIKE '%job_assignments%'
      AND qual ILIKE '%technician_id%'
  ),
  'sub_rentals reads are correlated to the row department or its assigned job'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND policyname = 'sub_rentals_insert_scoped'
      AND with_check ILIKE '%created_by = auth.uid()%'
      AND with_check ILIKE '%assignment.job_id = sub_rentals.job_id%'
  ),
  'sub_rentals inserts are self-attributed and scope checked'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '([a-z_]+)\.department[[:space:]]*=[[:space:]]*\1\.department'
  ),
  'no sub_rentals policy contains a self-comparison department tautology'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '([a-z_]+)\.job_id[[:space:]]*=[[:space:]]*\1\.job_id'
  ),
  'no sub_rentals policy contains a self-comparison job assignment tautology'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%and true%'
  ),
  'sub_rentals policies have no unconditional authenticated-user branch'
);

SELECT ok(
  (
    SELECT bool_and(roles = ARRAY['authenticated']::name[])
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sub_rentals'
      AND policyname LIKE 'sub_rentals_%_scoped'
  ),
  'sub_rentals policies apply only to authenticated callers'
);

-- Exercise the policies as real authenticated principals. The two sound rows
-- must not leak to a video user, while a video technician assigned to the job
-- retains the intended cross-department job visibility.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'a9100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sub-rental-sound@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'a9100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sub-rental-video@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'a9100000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sub-rental-assigned@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('a9100000-0000-0000-0000-000000000001'::uuid, 'sub-rental-sound@test.local', 'Sub', 'Sound', 'technician', 'sound'),
  ('a9100000-0000-0000-0000-000000000002'::uuid, 'sub-rental-video@test.local', 'Sub', 'Video', 'technician', 'video'),
  ('a9100000-0000-0000-0000-000000000003'::uuid, 'sub-rental-assigned@test.local', 'Sub', 'Assigned', 'technician', 'video')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.equipment (id, name, department)
VALUES ('a9200000-0000-0000-0000-000000000001'::uuid, 'Sub-rental sound test equipment', 'sound')
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  'a9300000-0000-0000-0000-000000000001'::uuid,
  'Sub-rental RLS Test Job',
  '2026-07-09 08:00:00+02'::timestamptz,
  '2026-07-10 02:00:00+02'::timestamptz,
  'festival'
)
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    job_type = excluded.job_type;

INSERT INTO public.job_assignments (job_id, technician_id)
VALUES (
  'a9300000-0000-0000-0000-000000000001'::uuid,
  'a9100000-0000-0000-0000-000000000003'::uuid
)
ON CONFLICT DO NOTHING;

INSERT INTO public.sub_rentals (
  id, equipment_id, quantity, start_date, end_date, created_by, job_id
) VALUES
  (
    'a9400000-0000-0000-0000-000000000001'::uuid,
    'a9200000-0000-0000-0000-000000000001'::uuid,
    1, '2026-07-09', '2026-07-10',
    'a9100000-0000-0000-0000-000000000001'::uuid,
    'a9300000-0000-0000-0000-000000000001'::uuid
  ),
  (
    'a9400000-0000-0000-0000-000000000002'::uuid,
    'a9200000-0000-0000-0000-000000000001'::uuid,
    1, '2026-07-09', '2026-07-10',
    'a9100000-0000-0000-0000-000000000001'::uuid,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET equipment_id = excluded.equipment_id,
    quantity = excluded.quantity,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    created_by = excluded.created_by,
    job_id = excluded.job_id;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'a9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  ARRAY(
    SELECT id FROM public.sub_rentals
    WHERE id IN (
      'a9400000-0000-0000-0000-000000000001'::uuid,
      'a9400000-0000-0000-0000-000000000002'::uuid
    )
    ORDER BY id
  ),
  ARRAY[
    'a9400000-0000-0000-0000-000000000001'::uuid,
    'a9400000-0000-0000-0000-000000000002'::uuid
  ],
  'a sound technician sees sound department sub-rentals'
);

SELECT lives_ok(
  $$
    INSERT INTO public.sub_rentals (
      id, equipment_id, quantity, start_date, end_date, created_by
    ) VALUES (
      'a9400000-0000-0000-0000-000000000003'::uuid,
      'a9200000-0000-0000-0000-000000000001'::uuid,
      1, '2026-07-09', '2026-07-10',
      'a9100000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'a sound technician can create a self-attributed sound sub-rental'
);

SELECT throws_ok(
  $$
    INSERT INTO public.sub_rentals (
      equipment_id, quantity, start_date, end_date, created_by
    ) VALUES (
      'a9200000-0000-0000-0000-000000000001'::uuid,
      1, '2026-07-09', '2026-07-10',
      'a9100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '42501',
  NULL,
  'a sound technician cannot forge another user as created_by'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a9100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT is_empty(
  $$
    SELECT id FROM public.sub_rentals
    WHERE id IN (
      'a9400000-0000-0000-0000-000000000001'::uuid,
      'a9400000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  'an unrelated video technician cannot read sound sub-rentals'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a9100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT is(
  ARRAY(
    SELECT id FROM public.sub_rentals
    WHERE id = 'a9400000-0000-0000-0000-000000000001'::uuid
  ),
  ARRAY['a9400000-0000-0000-0000-000000000001'::uuid],
  'a technician assigned to the job can read its cross-department sub-rental'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.sub_rentals
WHERE id IN (
  'a9400000-0000-0000-0000-000000000001'::uuid,
  'a9400000-0000-0000-0000-000000000002'::uuid,
  'a9400000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.job_assignments
WHERE job_id = 'a9300000-0000-0000-0000-000000000001'::uuid
  AND technician_id = 'a9100000-0000-0000-0000-000000000003'::uuid;
DELETE FROM public.jobs WHERE id = 'a9300000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.equipment WHERE id = 'a9200000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.profiles WHERE id IN (
  'a9100000-0000-0000-0000-000000000001'::uuid,
  'a9100000-0000-0000-0000-000000000002'::uuid,
  'a9100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'a9100000-0000-0000-0000-000000000001'::uuid,
  'a9100000-0000-0000-0000-000000000002'::uuid,
  'a9100000-0000-0000-0000-000000000003'::uuid
);

SELECT * FROM finish();
