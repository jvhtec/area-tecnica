CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(32);

SELECT has_table('public', 'festival_push_subscriptions', 'festival push subscriptions table exists');
SELECT has_table('public', 'festival_push_delivery_log', 'festival push delivery log table exists');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.festival_push_subscriptions'::regclass
      AND conname = 'festival_push_subscriptions_user_job_key'
  ),
  'festival push subscriptions are unique per user/job'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.festival_push_delivery_log'::regclass
      AND conname = 'festival_push_delivery_log_user_event_key'
  ),
  'festival push delivery log dedupes per user/event'
);

SELECT ok(
  to_regprocedure('public.get_festival_assigned_stages(uuid,uuid)') IS NOT NULL,
  'assigned festival stages helper exists'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.get_festival_assigned_stages(uuid,uuid)')
  ), false),
  'assigned festival stages helper pins pg_catalog/public search_path'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.get_festival_assigned_stages(uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.get_festival_assigned_stages(uuid,uuid)', 'EXECUTE'),
  'direct assigned-stage helper is service-role only'
);

SELECT ok(
  to_regprocedure('public.can_manage_festival_push_subscription(uuid,uuid,boolean,integer[])') IS NOT NULL,
  'festival push subscription authorization helper exists'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.can_manage_festival_push_subscription(uuid,uuid,boolean,integer[])')
  ), false),
  'festival push subscription authorization helper pins pg_catalog/public search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.can_manage_festival_push_subscription(uuid,uuid,boolean,integer[])', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.can_manage_festival_push_subscription(uuid,uuid,boolean,integer[])', 'EXECUTE'),
  'festival push subscription helper is available to authenticated users only'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.festival_push_subscriptions', 'SELECT')
  AND has_table_privilege('authenticated', 'public.festival_push_subscriptions', 'SELECT'),
  'anonymous users cannot select festival push subscriptions'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.festival_push_delivery_log', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.festival_push_delivery_log', 'SELECT')
  AND has_table_privilege('service_role', 'public.festival_push_delivery_log', 'INSERT'),
  'festival push delivery log is service-role only'
);

SELECT ok(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_push_subscriptions'
      AND policyname IN (
        'festival_push_subscriptions_select_own',
        'festival_push_subscriptions_insert_own',
        'festival_push_subscriptions_update_own',
        'festival_push_subscriptions_delete_own'
      )
  ) = 4,
  'festival push subscriptions have the four scoped policies'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_push_subscriptions'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%can_manage_festival_push_subscription%'
  ),
  'subscription inserts call the authorization helper'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_push_subscriptions'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%auth.uid%'
      AND with_check ILIKE '%can_manage_festival_push_subscription%'
  ),
  'subscription updates are self-scoped and call the authorization helper'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = to_regprocedure('public.can_manage_festival_push_subscription(uuid,uuid,boolean,integer[])')
      AND pg_get_functiondef(oid) ILIKE '%admin%'
      AND pg_get_functiondef(oid) ILIKE '%management%'
      AND pg_get_functiondef(oid) ILIKE '%technician%'
      AND pg_get_functiondef(oid) ILIKE '%house_tech%'
      AND pg_get_functiondef(oid) ILIKE '%get_festival_assigned_stages%'
  ),
  'authorization helper preserves admin/management and assigned technician/house_tech paths'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = to_regprocedure('public.can_manage_festival_push_subscription(uuid,uuid,boolean,integer[])')
      AND pg_get_functiondef(oid) ILIKE '%array_length%'
      AND pg_get_functiondef(oid) ILIKE '%p_stages <@ v_assigned_stages%'
  ),
  'authorization helper requires non-empty enabled stage arrays and assigned-stage containment'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = to_regprocedure('public.get_festival_assigned_stages(uuid,uuid)')
      AND pg_get_functiondef(oid) ILIKE '%festival_shift_assignments%'
      AND pg_get_functiondef(oid) ILIKE '%technician_id%'
      AND pg_get_functiondef(oid) ILIKE '%fs.stage IS NOT NULL%'
  ),
  'assigned-stage helper uses festival shift assignments and ignores external-only rows'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.festival_push_subscriptions'::regclass
      AND conname = 'festival_push_subscriptions_stages_valid'
      AND pg_get_constraintdef(oid) ILIKE '%<@ ARRAY%'
  ),
  'subscription stages are constrained to positive stage numbers'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'festival_push_subscriptions'
      AND indexname = 'idx_festival_push_subscriptions_job_enabled'
  ),
  'festival push scheduler has a job/enabled subscription index'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'festival_push_delivery_log'
      AND indexname = 'idx_festival_push_delivery_log_job_due'
  ),
  'festival push delivery log has a job/due index'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'festival_push_delivery_log'
      AND indexname = 'idx_festival_push_delivery_log_sent_at'
  ),
  'festival push delivery log has a sent_at cleanup index'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'festival-push-delivery-log-cleanup'
      AND schedule = '17 4 * * *'
      AND command ILIKE '%festival_push_delivery_log%'
      AND command ILIKE '%14 days%'
  ),
  'festival push delivery log has a scheduled retention cleanup'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'festival-feed-admin@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '10000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'festival-feed-manager@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '10000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'festival-feed-tech@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '10000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'festival-feed-house@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '10000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'festival-feed-unassigned-tech@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'festival-feed-admin@test.local', 'Feed', 'Admin', 'admin', 'sound'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'festival-feed-manager@test.local', 'Feed', 'Manager', 'management', 'sound'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'festival-feed-tech@test.local', 'Feed', 'Tech', 'technician', 'sound'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'festival-feed-house@test.local', 'Feed', 'House', 'house_tech', 'sound'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'festival-feed-unassigned-tech@test.local', 'Feed', 'Unassigned', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO UPDATE
SET label = excluded.label,
    default_visibility = excluded.default_visibility,
    severity = excluded.severity,
    toast_enabled = excluded.toast_enabled;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  '20000000-0000-0000-0000-000000000001'::uuid,
  'Festival Feed RLS Test',
  '2026-07-03 08:00:00+02'::timestamptz,
  '2026-07-04 02:00:00+02'::timestamptz,
  'festival'
)
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    job_type = excluded.job_type;

INSERT INTO public.festival_shifts (id, job_id, date, start_time, end_time, name, stage, department)
VALUES
  (
    '30000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000001'::uuid,
    '2026-07-03'::date,
    '09:00'::time,
    '13:00'::time,
    'Stage 2 shift',
    2,
    'sound'
  ),
  (
    '30000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000001'::uuid,
    '2026-07-03'::date,
    '14:00'::time,
    '18:00'::time,
    'Stage 3 shift',
    3,
    'sound'
  )
ON CONFLICT (id) DO UPDATE
SET job_id = excluded.job_id,
    date = excluded.date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    name = excluded.name,
    stage = excluded.stage,
    department = excluded.department;

INSERT INTO public.festival_shift_assignments (id, shift_id, technician_id, role, external_technician_name)
VALUES
  (
    '40000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'foh',
    NULL
  ),
  (
    '40000000-0000-0000-0000-000000000002'::uuid,
    '30000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    'house',
    NULL
  ),
  (
    '40000000-0000-0000-0000-000000000003'::uuid,
    '30000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'external',
    'External Tech'
  )
ON CONFLICT (id) DO UPDATE
SET shift_id = excluded.shift_id,
    technician_id = excluded.technician_id,
    role = excluded.role,
    external_technician_name = excluded.external_technician_name;

CREATE OR REPLACE FUNCTION public.__test_upsert_festival_push_subscription(
  p_user_id uuid,
  p_enabled boolean,
  p_stages integer[]
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.festival_push_subscriptions (user_id, job_id, enabled, stages)
  VALUES (
    p_user_id,
    '20000000-0000-0000-0000-000000000001'::uuid,
    p_enabled,
    p_stages
  )
  ON CONFLICT (user_id, job_id) DO UPDATE
  SET enabled = excluded.enabled,
      stages = excluded.stages;

  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT ok(
  public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000001'::uuid,
    true,
    ARRAY[1, 2]
  ),
  'admin can subscribe to multiple unassigned festival stages'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
SELECT ok(
  public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000002'::uuid,
    true,
    ARRAY[3]
  ),
  'management can subscribe without a festival shift assignment'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
SELECT ok(
  public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000003'::uuid,
    true,
    ARRAY[2]
  ),
  'technician can subscribe to an assigned stage'
);
SELECT ok(
  NOT public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000003'::uuid,
    true,
    ARRAY[3]
  ),
  'technician cannot subscribe to an unassigned stage'
);
SELECT ok(
  NOT public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000003'::uuid,
    true,
    ARRAY[2, 3]
  ),
  'technician cannot add an unassigned stage to a multi-stage subscription'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
SELECT ok(
  public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000004'::uuid,
    true,
    ARRAY[3]
  ),
  'house tech can subscribe to an assigned stage'
);
SELECT ok(
  NOT public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000004'::uuid,
    true,
    ARRAY[2]
  ),
  'house tech cannot subscribe to an unassigned stage'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', false);
SELECT ok(
  public.__test_upsert_festival_push_subscription(
    '10000000-0000-0000-0000-000000000005'::uuid,
    false,
    ARRAY[]::integer[]
  ),
  'unassigned technician can save a disabled empty subscription row'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.festival_push_subscriptions
    WHERE job_id = '20000000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'authenticated users only select their own festival feed subscription rows'
);

RESET ROLE;
DROP FUNCTION public.__test_upsert_festival_push_subscription(uuid, boolean, integer[]);

SELECT * FROM finish();
