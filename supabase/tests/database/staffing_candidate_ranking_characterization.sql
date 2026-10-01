\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

-- Test mutations and synthetic candidate fixtures must not survive local reruns.
BEGIN;

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
  ('cd100000-0000-0000-0000-000000000001'::uuid, 'rank-baseline@test.local'),
  ('cd100000-0000-0000-0000-000000000002'::uuid, 'rank-pending-availability@test.local'),
  ('cd100000-0000-0000-0000-000000000003'::uuid, 'rank-expired-availability@test.local'),
  ('cd100000-0000-0000-0000-000000000004'::uuid, 'rank-unavailable@test.local'),
  ('cd100000-0000-0000-0000-000000000005'::uuid, 'rank-fridge@test.local'),
  ('cd100000-0000-0000-0000-000000000006'::uuid, 'rank-assigned@test.local'),
  ('cd100000-0000-0000-0000-000000000007'::uuid, 'rank-cross-job-decline@test.local'),
  ('cd100000-0000-0000-0000-000000000008'::uuid, 'rank-role-offer@test.local'),
  ('cd100000-0000-0000-0000-000000000009'::uuid, 'rank-cross-job-same-role-offer@test.local'),
  ('cd100000-0000-0000-0000-000000000010'::uuid, 'rank-cross-job-other-role-offer@test.local'),
  ('cd100000-0000-0000-0000-000000000011'::uuid, 'rank-nonoverlap-decline@test.local'),
  ('cd100000-0000-0000-0000-000000000012'::uuid, 'rank-nonoverlap-pending@test.local'),
  ('cd100000-0000-0000-0000-000000000013'::uuid, 'rank-confirmed-availability@test.local'),
  ('cd100000-0000-0000-0000-000000000014'::uuid, 'rank-cross-job-unknown-role@test.local'),
  ('cd100000-0000-0000-0000-000000000015'::uuid, 'rank-cross-job-span-decline@test.local'),
  ('cd100000-0000-0000-0000-000000000016'::uuid, 'rank-event-role-fallback@test.local')
) AS fixtures(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id, email, first_name, last_name, role, department, assignable_as_tech
)
SELECT id, email, first_name, 'Candidate', 'technician', 'phase1-ranking', false
FROM (VALUES
  ('cd100000-0000-0000-0000-000000000001'::uuid, 'rank-baseline@test.local', 'Baseline'),
  ('cd100000-0000-0000-0000-000000000002'::uuid, 'rank-pending-availability@test.local', 'Pending'),
  ('cd100000-0000-0000-0000-000000000003'::uuid, 'rank-expired-availability@test.local', 'Expired'),
  ('cd100000-0000-0000-0000-000000000004'::uuid, 'rank-unavailable@test.local', 'Unavailable'),
  ('cd100000-0000-0000-0000-000000000005'::uuid, 'rank-fridge@test.local', 'Fridge'),
  ('cd100000-0000-0000-0000-000000000006'::uuid, 'rank-assigned@test.local', 'Assigned'),
  ('cd100000-0000-0000-0000-000000000007'::uuid, 'rank-cross-job-decline@test.local', 'CrossDecline'),
  ('cd100000-0000-0000-0000-000000000008'::uuid, 'rank-role-offer@test.local', 'RoleOffer'),
  ('cd100000-0000-0000-0000-000000000009'::uuid, 'rank-cross-job-same-role-offer@test.local', 'SameRole'),
  ('cd100000-0000-0000-0000-000000000010'::uuid, 'rank-cross-job-other-role-offer@test.local', 'OtherRole'),
  ('cd100000-0000-0000-0000-000000000011'::uuid, 'rank-nonoverlap-decline@test.local', 'NonOverlap'),
  ('cd100000-0000-0000-0000-000000000012'::uuid, 'rank-nonoverlap-pending@test.local', 'PendingOtherDay'),
  ('cd100000-0000-0000-0000-000000000013'::uuid, 'rank-confirmed-availability@test.local', 'ConfirmedAvailability'),
  ('cd100000-0000-0000-0000-000000000014'::uuid, 'rank-cross-job-unknown-role@test.local', 'UnknownRole'),
  ('cd100000-0000-0000-0000-000000000015'::uuid, 'rank-cross-job-span-decline@test.local', 'SpanDecline'),
  ('cd100000-0000-0000-0000-000000000016'::uuid, 'rank-event-role-fallback@test.local', 'EventFallback')
) AS fixtures(id, email, first_name)
ON CONFLICT (id) DO UPDATE
SET department = excluded.department,
    role = excluded.role,
    assignable_as_tech = excluded.assignable_as_tech;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES
  (
    'cd200000-0000-0000-0000-000000000001'::uuid,
    'Ranking Target',
    '2026-10-25 08:00:00+01'::timestamptz,
    '2026-10-25 20:00:00+01'::timestamptz,
    'single',
    'Confirmado'
  ),
  (
    'cd200000-0000-0000-0000-000000000002'::uuid,
    'Ranking Declined Other Job',
    '2026-10-25 09:00:00+01'::timestamptz,
    '2026-10-25 19:00:00+01'::timestamptz,
    'single',
    'Confirmado'
  )
ON CONFLICT (id) DO UPDATE
SET start_time = excluded.start_time,
    end_time = excluded.end_time;

INSERT INTO public.staffing_requests (
  id, job_id, profile_id, phase, status, token_hash, token_expires_at,
  single_day, target_date, role_code
) VALUES
  (
    'cd300000-0000-0000-0000-000000000001'::uuid,
    'cd200000-0000-0000-0000-000000000001'::uuid,
    'cd100000-0000-0000-0000-000000000002'::uuid,
    'availability', 'pending', 'pending-job-availability', now() + interval '1 day',
    false, NULL, NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000002'::uuid,
    'cd200000-0000-0000-0000-000000000001'::uuid,
    'cd100000-0000-0000-0000-000000000003'::uuid,
    'availability', 'expired', 'expired-job-availability', now() + interval '1 day',
    false, NULL, NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000003'::uuid,
    'cd200000-0000-0000-0000-000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000007'::uuid,
    'availability', 'declined', 'cross-job-decline', now() + interval '1 day',
    true, '2026-10-25', NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000004'::uuid,
    'cd200000-0000-0000-0000-000000000001'::uuid,
    'cd100000-0000-0000-0000-000000000008'::uuid,
    'offer', 'pending', 'role-offer', now() + interval '1 day',
    false, NULL, 'SND-FOH-R'
  ),
  (
    'cd300000-0000-0000-0000-000000000005'::uuid,
    'cd200000-0000-0000-0000-00000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000009'::uuid,
    'offer', 'declined', 'ranking-005', now() + interval '1 day',
    true, '2026-10-25', 'SND-FOH-R'
  ),
  (
    'cd300000-0000-0000-0000-000000000006'::uuid,
    'cd200000-0000-0000-0000-00000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000010'::uuid,
    'offer', 'declined', 'ranking-006', now() + interval '1 day',
    true, '2026-10-25', 'LGT-MON-R'
  ),
  (
    'cd300000-0000-0000-0000-000000000007'::uuid,
    'cd200000-0000-0000-0000-00000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000011'::uuid,
    'availability', 'declined', 'ranking-007', now() + interval '1 day',
    true, '2026-10-24', NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000008'::uuid,
    'cd200000-0000-0000-0000-00000000000001'::uuid,
    'cd100000-0000-0000-0000-000000000012'::uuid,
    'availability', 'pending', 'ranking-008', now() + interval '1 day',
    true, '2026-10-24', NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000009'::uuid,
    'cd200000-0000-0000-0000-00000000000001'::uuid,
    'cd100000-0000-0000-0000-000000000013'::uuid,
    'availability', 'confirmed', 'ranking-009', now() + interval '1 day',
    false, NULL, NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000010'::uuid,
    'cd200000-0000-0000-0000-00000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000014'::uuid,
    'offer', 'declined', 'ranking-010', now() + interval '1 day',
    false, NULL, NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000011'::uuid,
    'cd200000-0000-0000-0000-00000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000015'::uuid,
    'availability', 'declined', 'ranking-011', now() + interval '1 day',
    false, NULL, NULL
  ),
  (
    'cd300000-0000-0000-0000-000000000012'::uuid,
    'cd200000-0000-0000-0000-00000000000002'::uuid,
    'cd100000-0000-0000-0000-000000000016'::uuid,
    'offer', 'declined', 'ranking-012', now() + interval '1 day',
    true, '2026-10-25', NULL
  )
ON CONFLICT (id) DO NOTHING;

-- The event fallback is used when an old declined offer has no role_code.
INSERT INTO public.staffing_events (staffing_request_id, event, meta)
VALUES (
  'cd300000-0000-0000-0000-000000000012'::uuid,
  'email_sent',
  '{"phase":"offer","role":"LGT-MON-R"}'::jsonb
);

INSERT INTO public.technician_availability (
  technician_id, date, status
) VALUES (
  'cd100000-0000-0000-0000-000000000004',
  '2026-10-25',
  'vacation'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.technician_fridge (
  technician_id, in_fridge, reason
) VALUES (
  'cd100000-0000-0000-0000-000000000005'::uuid,
  true,
  'phase1 ranking fixture'
)
ON CONFLICT (technician_id) DO UPDATE
SET in_fridge = true,
    reason = excluded.reason;

INSERT INTO public.job_assignments (
  id, job_id, technician_id, status, sound_role, assignment_source
) VALUES (
  'cd400000-0000-0000-0000-000000000001'::uuid,
  'cd200000-0000-0000-0000-000000000001'::uuid,
  'cd100000-0000-0000-0000-000000000006'::uuid,
  'invited',
  'SND-FOH-R',
  'direct'
)
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE phase1_rank_default AS
SELECT *
FROM public.rank_staffing_candidates(
  'cd200000-0000-0000-0000-000000000001'::uuid,
  'phase1-ranking',
  'SND-FOH-R',
  'assisted',
  '{}'::jsonb
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000001'::uuid
  ),
  'an otherwise eligible technician is returned'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000004'::uuid
  ),
  'explicit technician unavailability excludes a candidate'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000005'::uuid
  ),
  'fridge membership excludes a candidate by default'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000006'::uuid
  ),
  'an active assignment on the target job excludes a candidate'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000008'::uuid
  ),
  'an active same-role offer on the target job excludes a candidate'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000003'::uuid
  ),
  'an expired availability request does not exclude a candidate'
);

-- Required regression assertions: no TODO exemptions after restoration.
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000002'::uuid
  ),
  'pending job-scoped availability excludes another availability recommendation'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000007'::uuid
  ),
  'a same-date declined availability request from another job excludes the candidate'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000009'::uuid
  ),
  'same-day declined offer for the requested role excludes the candidate'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000010'::uuid
  ),
  'same-day declined offer for another role remains eligible'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000011'::uuid
  ),
  'declined availability on a different date does not exclude the candidate'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000012'::uuid
  ),
  'pending same-job availability on another date remains eligible'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000013'::uuid
  ),
  'confirmed job-scoped availability excludes another availability recommendation'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000014'::uuid
  ),
  'same-day declined offer with no role metadata excludes conservatively'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000015'::uuid
  ),
  'a declined full-span availability on an overlapping job excludes the candidate'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM phase1_rank_default
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000016'::uuid
  ),
  'declined offer without role_code uses event role fallback to avoid unrelated-role exclusion'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.rank_staffing_candidates(
      'cd200000-0000-0000-0000-000000000001'::uuid,
      'phase1-ranking',
      'SND-FOH-R',
      'assisted',
      '{"exclude_fridge":false}'::jsonb
    )
    WHERE profile_id = 'cd100000-0000-0000-0000-000000000005'::uuid
  ),
  'exclude_fridge=false makes a fridge candidate eligible again'
);

SELECT throws_ok(
  $$
    SELECT *
    FROM public.rank_staffing_candidates(
      'cd200000-0000-0000-0000-000000000099'::uuid,
      'phase1-ranking',
      'SND-FOH-R',
      'assisted',
      '{}'::jsonb
    )
  $$,
  'P0001',
  'Job not found',
  'ranking an unknown job fails explicitly'
);

SELECT ok(
  (
    SELECT bool_and(hard_conflict = false)
    FROM phase1_rank_default
  ),
  'returned candidates are already hard-conflict filtered'
);

SELECT * FROM finish();

ROLLBACK;
