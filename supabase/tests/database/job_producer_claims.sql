CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(37);

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
  'job_producer_claims has select, insert, and self-delete policies'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_producer_claims'
      AND policyname = 'job_producer_claims_insert'
      AND roles = ARRAY['authenticated']::name[]
      AND with_check ILIKE '%current_user_role%management%'
      AND with_check ILIKE '%current_user_department%'
      AND with_check ILIKE '%target_profile%department%'
      AND with_check NOT ILIKE '%admin%'
  ),
  'insert policy requires production management for peer assignment and validates the target department'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.job_producer_claims', 'SELECT')
    AND has_table_privilege('authenticated', 'public.job_producer_claims', 'INSERT')
    AND has_table_privilege('authenticated', 'public.job_producer_claims', 'DELETE')
    AND NOT has_table_privilege('authenticated', 'public.job_producer_claims', 'UPDATE')
    AND NOT has_table_privilege('anon', 'public.job_producer_claims', 'SELECT'),
  'Data API grants expose only authenticated select/insert/delete'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.job_producer_claims', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.job_producer_claims', 'DELETE')
    AND NOT has_table_privilege('anon', 'public.job_producer_claims', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.job_producer_claims', 'UPDATE'),
  'anonymous access and authenticated UPDATE remain ungranted'
);

SELECT function_privs_are(
  'public',
  'get_job_producer_claims',
  ARRAY['uuid[]'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the safe producer directory function'
);

SELECT function_privs_are(
  'public',
  'get_job_producer_contacts',
  ARRAY['uuid[]'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the producer contact function'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_job_producer_contacts(uuid[])', 'EXECUTE')
    AND (
      SELECT procedure.prosecdef
      FROM pg_proc AS procedure
      WHERE procedure.oid = 'public.get_job_producer_contacts(uuid[])'::regprocedure
    ),
  'the producer contact function is a definer function closed to anonymous callers'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.enforce_job_producer_claim_department()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.enforce_job_producer_claim_department()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.remove_job_producer_claims_for_dryhire()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.remove_job_producer_claims_for_dryhire()', 'EXECUTE'),
  'trigger-only claim functions are not callable by API roles'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    WHERE procedure.oid = 'public.enforce_job_producer_claim_department()'::regprocedure
      AND procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=""']
      AND pg_get_functiondef(procedure.oid) ILIKE '%FOR NO KEY UPDATE%'
  ),
  'claim validation is a hardened definer trigger that takes the required job-row lock'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    WHERE procedure.oid = 'public.remove_job_producer_claims_for_dryhire()'::regprocedure
      AND procedure.prosecdef
  )
    AND EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger
      WHERE trigger.tgrelid = 'public.jobs'::regclass
        AND trigger.tgname = 'remove_job_producer_claims_when_dryhire'
        AND NOT trigger.tgisinternal
    ),
  'dryhire cleanup is installed as a security-definer jobs trigger'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('job.updated', 'Job updated', 'management', 'info', false),
  ('job.deleted', 'Job deleted', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

-- Keep the focused test rerunnable after a prior assertion or fixture failure.
DELETE FROM public.job_producer_claims
WHERE job_id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.timesheets WHERE job_id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.job_assignments WHERE job_id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.jobs WHERE id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.profiles WHERE id IN (
  'd9100000-0000-0000-0000-000000000001'::uuid,
  'd9100000-0000-0000-0000-000000000002'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid,
  'd9100000-0000-0000-0000-000000000004'::uuid,
  'd9100000-0000-0000-0000-000000000005'::uuid,
  'd9100000-0000-0000-0000-000000000006'::uuid,
  'd9100000-0000-0000-0000-000000000007'::uuid,
  'd9100000-0000-0000-0000-000000000008'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'd9100000-0000-0000-0000-000000000001'::uuid,
  'd9100000-0000-0000-0000-000000000002'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid,
  'd9100000-0000-0000-0000-000000000004'::uuid,
  'd9100000-0000-0000-0000-000000000005'::uuid,
  'd9100000-0000-0000-0000-000000000006'::uuid,
  'd9100000-0000-0000-0000-000000000007'::uuid,
  'd9100000-0000-0000-0000-000000000008'::uuid
);

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
  ),
  (
    'd9100000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-production-user@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'd9100000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-sound-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'd9100000-0000-0000-0000-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-production-admin@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'd9100000-0000-0000-0000-000000000007'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-unrelated-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'd9100000-0000-0000-0000-000000000008'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'claim-logistics@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, nickname, role, department, phone)
VALUES
  ('d9100000-0000-0000-0000-000000000001'::uuid, 'claim-production-one@test.local', 'Ana', 'Ruiz', NULL, 'management', 'production', '+34600111222'),
  ('d9100000-0000-0000-0000-000000000002'::uuid, 'claim-production-two@test.local', 'Luis', 'Pérez', 'Lucho', 'technician', 'producción', NULL),
  ('d9100000-0000-0000-0000-000000000003'::uuid, 'claim-sound@test.local', 'Sara', 'Sonido', NULL, 'technician', 'sound', NULL),
  ('d9100000-0000-0000-0000-000000000004'::uuid, 'claim-production-user@test.local', 'Olga', 'Producción', NULL, 'technician', 'produccion', '  +34 600 33 34 44  '),
  ('d9100000-0000-0000-0000-000000000005'::uuid, 'claim-sound-manager@test.local', 'Mario', 'Sonido', NULL, 'management', 'sound', NULL),
  ('d9100000-0000-0000-0000-000000000006'::uuid, 'claim-production-admin@test.local', 'Adela', 'Admin', NULL, 'admin', 'production', NULL),
  ('d9100000-0000-0000-0000-000000000007'::uuid, 'claim-unrelated-tech@test.local', 'Nuria', 'Nadie', NULL, 'technician', 'sound', NULL),
  ('d9100000-0000-0000-0000-000000000008'::uuid, 'claim-logistics@test.local', 'Lola', 'Logística', NULL, 'logistics', 'logistics', NULL)
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    nickname = excluded.nickname,
    role = excluded.role,
    department = excluded.department,
    phone = excluded.phone;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES
  (
    'd9200000-0000-0000-0000-000000000001'::uuid,
    'Producer Claim Test Job',
    '2026-09-20 08:00:00+02'::timestamptz,
    '2026-09-20 20:00:00+02'::timestamptz,
    'single'
  ),
  (
    'd9200000-0000-0000-0000-000000000002'::uuid,
    'Producer Claim Dryhire Job',
    '2026-09-21 08:00:00+02'::timestamptz,
    '2026-09-21 20:00:00+02'::timestamptz,
    'dryhire'
  ),
  (
    'd9200000-0000-0000-0000-000000000003'::uuid,
    'Producer Claim Conversion Job',
    '2026-09-22 08:00:00+02'::timestamptz,
    '2026-09-22 20:00:00+02'::timestamptz,
    'single'
  ),
  (
    'd9200000-0000-0000-0000-000000000004'::uuid,
    'Producer Claim Authorization Job',
    '2026-09-23 08:00:00+02'::timestamptz,
    '2026-09-23 20:00:00+02'::timestamptz,
    'single'
  )
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    job_type = excluded.job_type;

-- Sara is staffed on the authorization job, so she is entitled to its producer
-- contact details. Nuria is staffed nowhere and must not be.
INSERT INTO public.job_assignments (job_id, technician_id)
VALUES (
  'd9200000-0000-0000-0000-000000000004'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid
)
ON CONFLICT DO NOTHING;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000001'::uuid,
      'd9100000-0000-0000-0000-000000000001'::uuid
    )
    RETURNING producer_id
  $$,
  $$VALUES ('d9100000-0000-0000-0000-000000000001'::uuid)$$,
  'a production manager can claim a job for themself'
);

SELECT results_eq(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000001'::uuid,
      'd9100000-0000-0000-0000-000000000002'::uuid
    )
    RETURNING producer_id
  $$,
  $$VALUES ('d9100000-0000-0000-0000-000000000002'::uuid)$$,
  'production management can assign a production peer using the accented department alias'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
  ),
  2,
  'producer claims remain additive for the same job'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.job_assignments
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'producer claims do not create job assignments or staffing rows'
);

SELECT results_eq(
  $$
    WITH inserted AS (
      INSERT INTO public.job_producer_claims (job_id, producer_id)
      VALUES
        ('d9200000-0000-0000-0000-000000000003'::uuid, 'd9100000-0000-0000-0000-000000000001'::uuid),
        ('d9200000-0000-0000-0000-000000000003'::uuid, 'd9100000-0000-0000-0000-000000000002'::uuid)
      RETURNING producer_id
    )
    SELECT producer_id FROM inserted ORDER BY producer_id
  $$,
  $$
    VALUES
      ('d9100000-0000-0000-0000-000000000001'::uuid),
      ('d9100000-0000-0000-0000-000000000002'::uuid)
  $$,
  'production management can add multiple claims to a regular job'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000004'::uuid,
      'd9100000-0000-0000-0000-000000000003'::uuid
    )
  $$,
  '23514',
  'job producer claims require a production-department profile',
  'even production management cannot assign a non-production target'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000002'::uuid,
      'd9100000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  '23514',
  'job producer claims are not allowed for dryhire jobs',
  'dryhire jobs reject producer claims'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000004', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000004'::uuid,
      'd9100000-0000-0000-0000-000000000004'::uuid
    )
    RETURNING producer_id
  $$,
  $$VALUES ('d9100000-0000-0000-0000-000000000004'::uuid)$$,
  'an ordinary production user can still self-claim'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000004'::uuid,
      'd9100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '42501',
  NULL,
  'an ordinary production user cannot assign another production user'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000005', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000004'::uuid,
      'd9100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '42501',
  NULL,
  'a non-production manager cannot assign a production target'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000006', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000004'::uuid,
      'd9100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '42501',
  NULL,
  'a production admin has no manager peer-assignment bypass'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    UPDATE public.jobs
    SET job_type = 'dryhire'::public.job_type
    WHERE id = 'd9200000-0000-0000-0000-000000000003'::uuid
    RETURNING job_type
  $$,
  $$VALUES ('dryhire'::public.job_type)$$,
  'converting a claimed regular job to dryhire updates the intended job'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000003'::uuid
  ),
  0,
  'dryhire conversion removes every producer claim despite caller RLS'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_producer_claims (job_id, producer_id)
    VALUES (
      'd9200000-0000-0000-0000-000000000003'::uuid,
      'd9100000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  '23514',
  'job producer claims are not allowed for dryhire jobs',
  'a converted dryhire job rejects new claims'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000004', false);
SET ROLE authenticated;

SELECT is_empty(
  $$
    DELETE FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
      AND producer_id = 'd9100000-0000-0000-0000-000000000001'::uuid
    RETURNING producer_id
  $$,
  'another user cannot release someone else''s claim'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    DELETE FROM public.job_producer_claims
    WHERE job_id = 'd9200000-0000-0000-0000-000000000001'::uuid
      AND producer_id = 'd9100000-0000-0000-0000-000000000002'::uuid
    RETURNING producer_id
  $$,
  $$VALUES ('d9100000-0000-0000-0000-000000000002'::uuid)$$,
  'a producer can release only their own claim'
);

SELECT is(
  (
    SELECT display_name
    FROM public.get_job_producer_claims(
      ARRAY['d9200000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  'Ana Ruiz',
  'the safe directory function still resolves producer display names'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000004', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT display_name, phone, email
    FROM public.get_job_producer_contacts(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  $$
    VALUES (
      'Olga Producción'::text,
      '+34 600 33 34 44'::text,
      'claim-production-user@test.local'::text
    )
  $$,
  'a producer sees their own contact row with surrounding whitespace trimmed'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT display_name, phone
    FROM public.get_job_producer_contacts(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  $$VALUES ('Olga Producción'::text, '+34 600 33 34 44'::text)$$,
  'a technician staffed on the job can reach its producer'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000007', false);
SET ROLE authenticated;

SELECT is_empty(
  $$
    SELECT producer_id
    FROM public.get_job_producer_contacts(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  'a technician who does not work the job gets no producer contact details'
);

SELECT results_eq(
  $$
    SELECT display_name
    FROM public.get_job_producer_claims(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  $$VALUES ('Olga Producción'::text)$$,
  'the name-only directory stays open to every authenticated caller'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT display_name, phone
    FROM public.get_job_producer_contacts(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  $$VALUES ('Olga Producción'::text, '+34 600 33 34 44'::text)$$,
  'management reaches the producer without being staffed on the job'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000006', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT display_name, phone
    FROM public.get_job_producer_contacts(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  $$VALUES ('Olga Producción'::text, '+34 600 33 34 44'::text)$$,
  'admin reaches the producer without being staffed on the job'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'd9100000-0000-0000-0000-000000000008', false);
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT display_name, phone
    FROM public.get_job_producer_contacts(
      ARRAY['d9200000-0000-0000-0000-000000000004'::uuid]
    )
  $$,
  $$VALUES ('Olga Producción'::text, '+34 600 33 34 44'::text)$$,
  'logistics reaches the producer without being staffed on the job'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.job_producer_claims
WHERE job_id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.timesheets WHERE job_id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.job_assignments WHERE job_id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.jobs WHERE id IN (
  'd9200000-0000-0000-0000-000000000001'::uuid,
  'd9200000-0000-0000-0000-000000000002'::uuid,
  'd9200000-0000-0000-0000-000000000003'::uuid,
  'd9200000-0000-0000-0000-000000000004'::uuid
);
DELETE FROM public.profiles WHERE id IN (
  'd9100000-0000-0000-0000-000000000001'::uuid,
  'd9100000-0000-0000-0000-000000000002'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid,
  'd9100000-0000-0000-0000-000000000004'::uuid,
  'd9100000-0000-0000-0000-000000000005'::uuid,
  'd9100000-0000-0000-0000-000000000006'::uuid,
  'd9100000-0000-0000-0000-000000000007'::uuid,
  'd9100000-0000-0000-0000-000000000008'::uuid
);
DELETE FROM auth.users WHERE id IN (
  'd9100000-0000-0000-0000-000000000001'::uuid,
  'd9100000-0000-0000-0000-000000000002'::uuid,
  'd9100000-0000-0000-0000-000000000003'::uuid,
  'd9100000-0000-0000-0000-000000000004'::uuid,
  'd9100000-0000-0000-0000-000000000005'::uuid,
  'd9100000-0000-0000-0000-000000000006'::uuid,
  'd9100000-0000-0000-0000-000000000007'::uuid,
  'd9100000-0000-0000-0000-000000000008'::uuid
);

SELECT * FROM finish();
