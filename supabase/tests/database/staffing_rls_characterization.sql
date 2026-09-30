\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(19);

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT id,
       '00000000-0000-0000-0000-000000000000'::uuid,
       email,
       'test',
       now(),
       now(),
       now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{}'::jsonb,
       'authenticated',
       'authenticated'
FROM (VALUES
  ('cc100000-0000-0000-0000-000000000001'::uuid, 'staffing-rls-sound@test.local'),
  ('cc100000-0000-0000-0000-000000000002'::uuid, 'staffing-rls-lights@test.local'),
  ('cc100000-0000-0000-0000-000000000003'::uuid, 'staffing-rls-admin@test.local'),
  ('cc100000-0000-0000-0000-000000000004'::uuid, 'staffing-rls-logistics@test.local'),
  ('cc100000-0000-0000-0000-000000000005'::uuid, 'staffing-rls-logistics-mgr@test.local'),
  ('cc100000-0000-0000-0000-000000000006'::uuid, 'staffing-rls-tech@test.local'),
  ('cc100000-0000-0000-0000-000000000007'::uuid, 'staffing-rls-other-tech@test.local')
) AS fixtures(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('cc100000-0000-0000-0000-000000000001', 'staffing-rls-sound@test.local', 'Sound', 'Manager', 'management', 'sound'),
  ('cc100000-0000-0000-0000-000000000002', 'staffing-rls-lights@test.local', 'Lights', 'Manager', 'management', 'lights'),
  ('cc100000-0000-0000-0000-000000000003', 'staffing-rls-admin@test.local', 'Staffing', 'Admin', 'admin', NULL),
  ('cc100000-0000-0000-0000-000000000004', 'staffing-rls-logistics@test.local', 'Staffing', 'Logistics', 'logistics', 'logistics'),
  ('cc100000-0000-0000-0000-000000000005', 'staffing-rls-logistics-mgr@test.local', 'Logistics', 'Manager', 'management', 'logistics'),
  ('cc100000-0000-0000-0000-000000000006', 'staffing-rls-tech@test.local', 'Own', 'Tech', 'technician', 'sound'),
  ('cc100000-0000-0000-0000-000000000007', 'staffing-rls-other-tech@test.local', 'Other', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department,
    email = excluded.email;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES
  ('cc200000-0000-0000-0000-000000000001', 'RLS Sound', '2026-10-22 08:00:00+02', '2026-10-22 20:00:00+02', 'single', 'Confirmado'),
  ('cc200000-0000-0000-0000-000000000002', 'RLS Lights', '2026-10-23 08:00:00+02', '2026-10-23 20:00:00+02', 'single', 'Confirmado'),
  ('cc200000-0000-0000-0000-000000000003', 'RLS Production', '2026-10-24 08:00:00+02', '2026-10-24 20:00:00+02', 'single', 'Confirmado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staffing_campaigns (
  id, job_id, department, created_by, mode, status, policy
) VALUES
  ('cc300000-0000-0000-0000-000000000001', 'cc200000-0000-0000-0000-000000000001', 'sound', 'cc100000-0000-0000-0000-000000000003', 'assisted', 'active', '{}'::jsonb),
  ('cc300000-0000-0000-0000-000000000002', 'cc200000-0000-0000-0000-000000000002', 'lights', 'cc100000-0000-0000-0000-000000000003', 'assisted', 'active', '{}'::jsonb),
  ('cc300000-0000-0000-0000-000000000003', 'cc200000-0000-0000-0000-000000000003', 'production', 'cc100000-0000-0000-0000-000000000003', 'assisted', 'active', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staffing_campaign_roles (
  id, campaign_id, role_code, stage
) VALUES
  ('cc400000-0000-0000-0000-000000000001', 'cc300000-0000-0000-0000-000000000001', 'SND-FOH-R', 'idle'),
  ('cc400000-0000-0000-0000-000000000002', 'cc300000-0000-0000-0000-000000000002', 'LGT-OP-R', 'idle'),
  ('cc400000-0000-0000-0000-000000000003', 'cc300000-0000-0000-0000-000000000003', 'PROD-PM-R', 'idle')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staffing_campaign_events (
  id, campaign_id, phase, role_code
) VALUES
  ('cc500000-0000-0000-0000-000000000001', 'cc300000-0000-0000-0000-000000000001', 'system', 'SND-FOH-R'),
  ('cc500000-0000-0000-0000-000000000002', 'cc300000-0000-0000-0000-000000000002', 'system', 'LGT-OP-R'),
  ('cc500000-0000-0000-0000-000000000003', 'cc300000-0000-0000-0000-000000000003', 'system', 'PROD-PM-R')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staffing_requests (
  id, job_id, profile_id, phase, status, token_hash, token_expires_at, requested_by
) VALUES
  ('cc600000-0000-0000-0000-000000000001', 'cc200000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000006', 'availability', 'pending', 'own-hash', now() + interval '1 day', 'cc100000-0000-0000-0000-000000000001'),
  ('cc600000-0000-0000-0000-000000000002', 'cc200000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000007', 'availability', 'pending', 'other-hash', now() + interval '1 day', 'cc100000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Sound manager -----------------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaigns),
  1,
  'sound management sees only its sound campaign'
);

SELECT is(
  (SELECT department FROM public.staffing_campaigns LIMIT 1),
  'sound',
  'sound management campaign visibility is correctly scoped'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaign_roles),
  1,
  'campaign-role RLS follows campaign department scope'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaign_events),
  1,
  'campaign-event RLS follows campaign department scope'
);

WITH changed AS (
  UPDATE public.staffing_campaigns
  SET status = 'paused'
  WHERE id = 'cc300000-0000-0000-0000-000000000001'
  RETURNING id
)
SELECT is((SELECT count(*)::integer FROM changed), 1,
  'sound management can update its own campaign');

WITH changed AS (
  UPDATE public.staffing_campaigns
  SET status = 'paused'
  WHERE id = 'cc300000-0000-0000-0000-000000000002'
  RETURNING id
)
SELECT is((SELECT count(*)::integer FROM changed), 0,
  'sound management cannot update a lights campaign');

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_requests),
  2,
  'management retains current unscoped staffing-request visibility'
);

RESET ROLE;

-- Lights manager ---------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaigns),
  1,
  'lights management sees only its lights campaign'
);

RESET ROLE;

-- Admin ------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaigns),
  3,
  'admin sees campaigns across all departments'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaign_roles),
  3,
  'admin sees campaign roles across all departments'
);

RESET ROLE;

-- Logistics role ---------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000004', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaigns),
  3,
  'logistics role sees campaigns across all departments'
);

RESET ROLE;

-- Logistics-scoped management --------------------------------------------------

SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000005', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaigns),
  1,
  'logistics-scoped management sees only the production exception'
);

SELECT is(
  (SELECT department FROM public.staffing_campaigns LIMIT 1),
  'production',
  'logistics-scoped management campaign visibility resolves to production'
);

RESET ROLE;

-- Technician -------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', 'cc100000-0000-0000-0000-000000000006', false);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaigns),
  0,
  'technicians cannot read staffing campaigns'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaign_roles),
  0,
  'technicians cannot read campaign role progress'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_campaign_events),
  0,
  'technicians cannot read campaign audit events'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staffing_requests),
  1,
  'technicians can read only their own staffing requests'
);

SELECT is(
  (SELECT profile_id FROM public.staffing_requests LIMIT 1),
  'cc100000-0000-0000-0000-000000000006'::uuid,
  'technician staffing-request visibility is scoped to auth.uid()'
);

SELECT throws_ok(
  $$
    INSERT INTO public.staffing_requests (
      job_id, profile_id, phase, status, token_hash, token_expires_at
    ) VALUES (
      'cc200000-0000-0000-0000-000000000001'::uuid,
      'cc100000-0000-0000-0000-000000000006'::uuid,
      'availability',
      'pending',
      'tech-self-created',
      now() + interval '1 day'
    )
  $$,
  '42501',
  NULL,
  'technicians cannot create their own staffing request'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT * FROM finish();
