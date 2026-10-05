\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
SELECT set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('df110000-0000-0000-0000-000000000001', 'df-tech@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department)
VALUES ('df110000-0000-0000-0000-000000000001', 'df-tech@test.local', 'Offer', 'Lock', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status) VALUES
  ('df210000-0000-0000-0000-000000000001', 'Offer target', '2026-12-21 08:00:00+01', '2026-12-23 20:00:00+01', 'single', 'Confirmado'),
  ('df210000-0000-0000-0000-000000000002', 'Already booked', '2026-12-22 08:00:00+01', '2026-12-22 20:00:00+01', 'single', 'Confirmado'),
  ('df210000-0000-0000-0000-000000000003', 'Legacy dryhire', '2026-12-23 08:00:00+01', '2026-12-23 20:00:00+01', 'dryhire', 'Confirmado');
INSERT INTO staffing_requests (id, job_id, profile_id, phase, status, token_hash, token_expires_at)
VALUES ('df310000-0000-0000-0000-000000000001', 'df210000-0000-0000-0000-000000000001', 'df110000-0000-0000-0000-000000000001',
        'offer', 'confirmed', 'hash', now() + interval '48 hours');
INSERT INTO job_assignments (job_id, technician_id, status) VALUES
  ('df210000-0000-0000-0000-000000000002', 'df110000-0000-0000-0000-000000000001', 'confirmed');
INSERT INTO timesheets (job_id, technician_id, date) VALUES
  ('df210000-0000-0000-0000-000000000002', 'df110000-0000-0000-0000-000000000001', '2026-12-22');
INSERT INTO timesheets (job_id, technician_id, date, is_schedule_only) VALUES
  ('df210000-0000-0000-0000-000000000003', 'df110000-0000-0000-0000-000000000001', '2026-12-23', true);

SELECT ok(pg_get_functiondef('public.assign_staffing_offer(uuid,date[],boolean,text)'::regprocedure) ~ 'assignment-technician:',
  'acceptance takes the per-technician key');
SELECT throws_ok($$ SELECT public.assign_staffing_offer('df310000-0000-0000-0000-000000000001', ARRAY['2026-12-21','2026-12-22']::date[], false, 'SND-FOH-R') $$,
  'P0409', 'assignment_conflict', 'an accepted day already worked elsewhere is refused under the lock');
SELECT is((SELECT count(*) FROM job_assignments WHERE job_id = 'df210000-0000-0000-0000-000000000001'), 0::bigint,
  'the refused acceptance writes no membership');
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'df210000-0000-0000-0000-000000000001'), 0::bigint,
  'the refused acceptance writes no schedule');
SELECT is((SELECT status FROM staffing_requests WHERE id = 'df310000-0000-0000-0000-000000000001'), 'confirmed',
  'the technician response itself stays committed');
SELECT lives_ok($$ SELECT public.assign_staffing_offer('df310000-0000-0000-0000-000000000001', ARRAY['2026-12-21','2026-12-23']::date[], false, 'SND-FOH-R') $$,
  'days free of other crew work commit; dry-hire rows are not conflicts');
SELECT results_eq($$ SELECT date FROM timesheets WHERE job_id = 'df210000-0000-0000-0000-000000000001' AND is_active ORDER BY date $$,
  $$ VALUES ('2026-12-21'::date), ('2026-12-23'::date) $$, 'exactly the accepted days are scheduled');

SELECT * FROM finish();
ROLLBACK;
