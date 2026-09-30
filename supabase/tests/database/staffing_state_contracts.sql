\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(41);

-- Structural state-machine guards ------------------------------------------------

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.staffing_requests'::regclass),
  'staffing_requests keeps RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.staffing_campaigns'::regclass),
  'staffing_campaigns keeps RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.staffing_campaign_roles'::regclass),
  'staffing_campaign_roles keeps RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.staffing_campaign_events'::regclass),
  'staffing_campaign_events keeps RLS enabled'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%phase%'
      AND pg_get_constraintdef(oid) LIKE '%availability%'
      AND pg_get_constraintdef(oid) LIKE '%offer%'
  ),
  'staffing_requests constrains phase to availability/offer'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
      AND pg_get_constraintdef(oid) LIKE '%pending%'
      AND pg_get_constraintdef(oid) LIKE '%confirmed%'
      AND pg_get_constraintdef(oid) LIKE '%declined%'
      AND pg_get_constraintdef(oid) LIKE '%expired%'
  ),
  'staffing_requests constrains the four request statuses'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%single_day%'
      AND pg_get_constraintdef(oid) LIKE '%target_date%'
  ),
  'single-day staffing requests require target_date'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_campaigns'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%mode%'
      AND pg_get_constraintdef(oid) LIKE '%assisted%'
      AND pg_get_constraintdef(oid) LIKE '%auto%'
  ),
  'staffing campaigns constrain assisted/auto mode'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_campaigns'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
      AND pg_get_constraintdef(oid) LIKE '%active%'
      AND pg_get_constraintdef(oid) LIKE '%paused%'
      AND pg_get_constraintdef(oid) LIKE '%stopped%'
      AND pg_get_constraintdef(oid) LIKE '%completed%'
      AND pg_get_constraintdef(oid) LIKE '%failed%'
  ),
  'staffing campaigns constrain lifecycle status'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_campaign_roles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%stage%'
      AND pg_get_constraintdef(oid) LIKE '%idle%'
      AND pg_get_constraintdef(oid) LIKE '%availability%'
      AND pg_get_constraintdef(oid) LIKE '%offer%'
      AND pg_get_constraintdef(oid) LIKE '%filled%'
      AND pg_get_constraintdef(oid) LIKE '%escalating%'
  ),
  'campaign roles constrain the five role stages'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_campaign_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%phase%'
      AND pg_get_constraintdef(oid) LIKE '%availability%'
      AND pg_get_constraintdef(oid) LIKE '%offer%'
      AND pg_get_constraintdef(oid) LIKE '%system%'
  ),
  'campaign events constrain availability/offer/system phases'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_campaigns'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%job_id%'
      AND pg_get_constraintdef(oid) LIKE '%department%'
  ),
  'only one staffing campaign may exist per job and department'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staffing_campaign_roles'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%campaign_id%'
      AND pg_get_constraintdef(oid) LIKE '%role_code%'
  ),
  'campaign role codes are unique inside a campaign'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE i.indrelid = 'public.staffing_requests'::regclass
      AND idx.relname = 'idx_staffing_requests_idempotency'
      AND NOT i.indisunique
  ),
  'staffing request idempotency is intentionally application-level, not a DB unique constraint'
);

SELECT is(
  (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staffing_requests'
      AND column_name = 'idempotency_key'
  ),
  'text',
  'idempotency_key accepts semantic text keys'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staffing_requests'
      AND column_name = 'role_code'
  ),
  'staffing_requests retains role_code for role-specific phases'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.staffing_requests'::regclass
      AND c.contype = 'f'
      AND a.attname = 'requested_by'
      AND c.confdeltype = 'n'
  ),
  'staffing request requester attribution is SET NULL on profile deletion'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.staffing_campaign_roles'::regclass
      AND c.confrelid = 'public.staffing_campaigns'::regclass
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ),
  'campaign-role rows cascade when their campaign is deleted'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.staffing_campaign_events'::regclass
      AND c.confrelid = 'public.staffing_campaigns'::regclass
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ),
  'campaign-event rows cascade when their campaign is deleted'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.staffing_campaigns'::regclass
      AND c.confrelid = 'public.jobs'::regclass
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ),
  'staffing campaigns cascade when their job is deleted'
);

-- Behavioral fixtures -----------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'cb100000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'staffing-state-manager@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'cb100000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'staffing-state-tech@test.local', 'test', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  (
    'cb100000-0000-0000-0000-000000000001'::uuid,
    'staffing-state-manager@test.local',
    'State',
    'Manager',
    'management',
    'sound'
  ),
  (
    'cb100000-0000-0000-0000-000000000002'::uuid,
    'staffing-state-tech@test.local',
    'State',
    'Tech',
    'technician',
    'sound'
  )
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES
  (
    'cb200000-0000-0000-0000-000000000001'::uuid,
    'Staffing State Contract',
    '2026-10-20 08:00:00+02'::timestamptz,
    '2026-10-20 20:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  ),
  (
    'cb200000-0000-0000-0000-000000000002'::uuid,
    'Campaign Job Cascade Contract',
    '2026-10-21 08:00:00+02'::timestamptz,
    '2026-10-21 20:00:00+02'::timestamptz,
    'single',
    'Confirmado'
  )
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time;

SELECT lives_ok(
  $$
    INSERT INTO public.staffing_requests (
      id, job_id, profile_id, phase, status, token_hash, token_expires_at,
      single_day, target_date, idempotency_key, requested_by
    ) VALUES (
      'cb300000-0000-0000-0000-000000000001'::uuid,
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'availability', 'pending', 'hash-1', now() + interval '2 days',
      false, NULL, 'phase1:semantic:key', 'cb100000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'a valid full-span availability request is accepted'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_requests (
      job_id, profile_id, phase, status, token_hash, token_expires_at
    ) VALUES (
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'maybe', 'pending', 'hash-invalid-phase', now() + interval '2 days'
    )
  $$,
  '23514',
  NULL,
  'an unsupported staffing phase is rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_requests (
      job_id, profile_id, phase, status, token_hash, token_expires_at
    ) VALUES (
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'offer', 'cancelled', 'hash-invalid-status', now() + interval '2 days'
    )
  $$,
  '23514',
  NULL,
  'cancelled is not a staffing-request status; cancellation remains expired'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_requests (
      job_id, profile_id, phase, status, token_hash, token_expires_at,
      single_day, target_date
    ) VALUES (
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'offer', 'pending', 'hash-missing-date', now() + interval '2 days',
      true, NULL
    )
  $$,
  '23514',
  NULL,
  'single-day requests without a target date are rejected'
);

SELECT lives_ok(
  $$
    INSERT INTO public.staffing_requests (
      id, job_id, profile_id, phase, status, token_hash, token_expires_at,
      single_day, target_date, idempotency_key
    ) VALUES (
      'cb300000-0000-0000-0000-000000000002'::uuid,
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'offer', 'pending', 'hash-2', now() + interval '2 days',
      true, '2026-10-20', 'phase1:semantic:key'
    )
  $$,
  'the database permits repeated semantic idempotency keys'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.staffing_requests
    WHERE idempotency_key = 'phase1:semantic:key'
  ),
  2,
  'idempotency deduplication is not enforced by a unique DB index'
);

SELECT lives_ok(
  $$
    INSERT INTO public.staffing_campaigns (
      id, job_id, department, created_by, mode, status, policy
    ) VALUES (
      'cb400000-0000-0000-0000-000000000001'::uuid,
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'sound',
      'cb100000-0000-0000-0000-000000000001'::uuid,
      'assisted',
      'active',
      '{"waves":{"mode":"controlled_waves"}}'::jsonb
    )
  $$,
  'a valid assisted campaign is accepted'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_campaigns (
      job_id, department, created_by, mode, status, policy
    ) VALUES (
      'cb200000-0000-0000-0000-000000000001'::uuid,
      'sound',
      'cb100000-0000-0000-0000-000000000001'::uuid,
      'auto',
      'active',
      '{}'::jsonb
    )
  $$,
  '23505',
  NULL,
  'only one campaign may exist for a job/department pair'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_campaigns (
      job_id, department, created_by, mode, status, policy
    ) VALUES (
      'cb200000-0000-0000-0000-000000000002'::uuid,
      'lights',
      'cb100000-0000-0000-0000-000000000001'::uuid,
      'manual',
      'active',
      '{}'::jsonb
    )
  $$,
  '23514',
  NULL,
  'unsupported campaign mode is rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_campaigns (
      job_id, department, created_by, mode, status, policy
    ) VALUES (
      'cb200000-0000-0000-0000-000000000002'::uuid,
      'lights',
      'cb100000-0000-0000-0000-000000000001'::uuid,
      'auto',
      'cancelled',
      '{}'::jsonb
    )
  $$,
  '23514',
  NULL,
  'unsupported campaign status is rejected'
);

SELECT lives_ok(
  $$
    INSERT INTO public.staffing_campaign_roles (
      id, campaign_id, role_code, stage
    ) VALUES (
      'cb500000-0000-0000-0000-000000000001'::uuid,
      'cb400000-0000-0000-0000-000000000001'::uuid,
      'SND-FOH-R',
      'availability'
    )
  $$,
  'a valid campaign role is accepted'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_campaign_roles (
      campaign_id, role_code, stage
    ) VALUES (
      'cb400000-0000-0000-0000-000000000001'::uuid,
      'SND-FOH-R',
      'offer'
    )
  $$,
  '23505',
  NULL,
  'a role code cannot be duplicated inside a campaign'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_campaign_roles (
      campaign_id, role_code, stage
    ) VALUES (
      'cb400000-0000-0000-0000-000000000001'::uuid,
      'SND-PA',
      'waiting'
    )
  $$,
  '23514',
  NULL,
  'unsupported campaign-role stage is rejected'
);

SELECT lives_ok(
  $$
    INSERT INTO public.staffing_campaign_events (
      id, campaign_id, phase, profile_id, role_code, wave_number
    ) VALUES (
      'cb600000-0000-0000-0000-000000000001'::uuid,
      'cb400000-0000-0000-0000-000000000001'::uuid,
      'availability',
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'SND-FOH-R',
      1
    )
  $$,
  'a valid campaign audit event is accepted'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_campaign_events (
      campaign_id, phase, profile_id, role_code
    ) VALUES (
      'cb400000-0000-0000-0000-000000000001'::uuid,
      'click',
      'cb100000-0000-0000-0000-000000000002'::uuid,
      'SND-FOH-R'
    )
  $$,
  '23514',
  NULL,
  'unsupported campaign-event phase is rejected'
);

SELECT lives_ok(
  $$
    DELETE FROM public.staffing_campaigns
    WHERE id = 'cb400000-0000-0000-0000-000000000001'::uuid
  $$,
  'campaign deletion succeeds with dependent role/event rows'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.staffing_campaign_roles
    WHERE campaign_id = 'cb400000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'deleting a campaign cascades its role progress rows'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.staffing_campaign_events
    WHERE campaign_id = 'cb400000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'deleting a campaign cascades its campaign audit events'
);

SELECT lives_ok(
  $$
    INSERT INTO public.staffing_campaigns (
      id, job_id, department, created_by, mode, status, policy
    ) VALUES (
      'cb400000-0000-0000-0000-000000000002'::uuid,
      'cb200000-0000-0000-0000-000000000002'::uuid,
      'sound',
      'cb100000-0000-0000-0000-000000000001'::uuid,
      'auto',
      'paused',
      '{}'::jsonb
    )
  $$,
  'a second campaign fixture is accepted for job-cascade characterization'
);

SELECT lives_ok(
  $$
    DELETE FROM public.jobs
    WHERE id = 'cb200000-0000-0000-0000-000000000002'::uuid
  $$,
  'job deletion succeeds with an attached staffing campaign'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.staffing_campaigns
    WHERE id = 'cb400000-0000-0000-0000-000000000002'::uuid
  ),
  0,
  'deleting a job cascades its staffing campaign'
);

SELECT * FROM finish();
