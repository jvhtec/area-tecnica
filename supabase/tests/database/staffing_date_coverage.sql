\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(14);
SELECT set_config('request.jwt.claim.role', 'service_role', true);

-- Database boundary tests complement the real-handler tests: keep actual
-- assignment/prep-day triggers and partial indexes enabled. All fixtures roll back.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('cb110000-0000-0000-0000-000000000001', 'coverage-tech@test.local',
        '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department)
VALUES ('cb110000-0000-0000-0000-000000000001', 'coverage-tech@test.local',
        'Coverage', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false),
       ('assignment.created', 'Assignment created', 'management', 'info', false),
       ('assignment.updated', 'Assignment updated', 'management', 'info', false),
       ('timesheet.approved', 'Timesheet approved', 'management', 'info', false),
       ('staffing.availability.declined', 'Availability declined', 'management', 'info', false),
       ('staffing.availability.confirmed', 'Availability confirmed', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status)
VALUES ('cb210000-0000-0000-0000-000000000001', 'Staffing coverage boundary',
        '2026-10-20 08:00:00+02', '2026-10-24 20:00:00+02', 'single', 'Confirmado');
INSERT INTO job_date_types (job_id, date, type)
VALUES ('cb210000-0000-0000-0000-000000000001', '2026-10-20', 'prep_day');
INSERT INTO job_assignments (job_id, technician_id, status, single_day, assignment_date, sound_role)
VALUES ('cb210000-0000-0000-0000-000000000001', 'cb110000-0000-0000-0000-000000000001',
        'confirmed', true, '2026-10-20', 'SND-FOH-R');
SELECT ok((SELECT is_active FROM timesheets WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
           AND technician_id = 'cb110000-0000-0000-0000-000000000001' AND date = '2026-10-20'),
          'real assignment trigger creates the accepted prep-day timesheet');
UPDATE timesheets SET start_time = '09:00', end_time = '17:00', notes = 'Approved preparation',
       approved_by_manager = true, signature_data = 'existing-signature'
WHERE job_id = 'cb210000-0000-0000-0000-000000000001' AND date = '2026-10-20';
CREATE TEMP TABLE original_prep ON COMMIT DROP AS
SELECT to_jsonb(t) AS snapshot FROM timesheets t
WHERE job_id = 'cb210000-0000-0000-0000-000000000001' AND date = '2026-10-20';

-- The extension must not include any prep-trigger columns in this update.
UPDATE job_assignments SET sound_role = 'SND-MON-R', assignment_source = 'staffing', response_time = now()
WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
  AND technician_id = 'cb110000-0000-0000-0000-000000000001' AND status = 'confirmed';
SELECT is((SELECT to_jsonb(t) FROM timesheets t WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
           AND date = '2026-10-20'), (SELECT snapshot FROM original_prep),
          'extending confirmed membership preserves every existing prep-day field, including amount and approval');
SELECT ok((SELECT single_day AND assignment_date = '2026-10-20' AND status = 'confirmed'
           FROM job_assignments WHERE job_id = 'cb210000-0000-0000-0000-000000000001'),
          'extension preserves existing membership scope metadata');

INSERT INTO timesheets (job_id, technician_id, date, is_active, notes, signature_data, approved_by_manager)
VALUES ('cb210000-0000-0000-0000-000000000001', 'cb110000-0000-0000-0000-000000000001',
        '2026-10-22', false, 'Previously entered hours', 'saved-signature', true);
-- Same conflict target and payload fields as the click handler. Reactivate only
-- this accepted date; do not replace the rest of the technician's schedule.
INSERT INTO timesheets (job_id, technician_id, date, is_schedule_only, source, is_active)
VALUES ('cb210000-0000-0000-0000-000000000001', 'cb110000-0000-0000-0000-000000000001',
        '2026-10-22', false, 'staffing', true)
ON CONFLICT (job_id, technician_id, date) DO UPDATE
SET job_id = excluded.job_id, technician_id = excluded.technician_id, date = excluded.date,
    is_schedule_only = excluded.is_schedule_only, source = excluded.source, is_active = excluded.is_active;
SELECT is((SELECT array_agg(date ORDER BY date)::text FROM timesheets
           WHERE job_id = 'cb210000-0000-0000-0000-000000000001' AND is_active),
          '{2026-10-20,2026-10-22}', 'only the old prep day and accepted added day are active');
SELECT ok((SELECT notes = 'Previously entered hours' AND signature_data = 'saved-signature'
                  AND approved_by_manager AND is_active FROM timesheets
           WHERE job_id = 'cb210000-0000-0000-0000-000000000001' AND date = '2026-10-22'),
          'reactivating an accepted date preserves entered notes, signature and approval');
SELECT is((SELECT to_jsonb(t) FROM timesheets t WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
           AND date = '2026-10-20'), (SELECT snapshot FROM original_prep),
          'appending an accepted date leaves the previously approved prep day unchanged');

INSERT INTO staffing_requests (id, job_id, profile_id, phase, status, single_day, target_date, batch_id, token_hash, token_expires_at)
VALUES ('cb310000-0000-0000-0000-000000000001', 'cb210000-0000-0000-0000-000000000001',
        'cb110000-0000-0000-0000-000000000001', 'availability', 'pending', true, '2026-10-22',
        'cb400000-0000-0000-0000-000000000001', 'hash', now() + interval '48 hours'),
       ('cb310000-0000-0000-0000-000000000002', 'cb210000-0000-0000-0000-000000000001',
        'cb110000-0000-0000-0000-000000000001', 'availability', 'pending', true, '2026-10-23',
        'cb400000-0000-0000-0000-000000000001', 'hash', now() + interval '48 hours');
SELECT is((SELECT count(*) FROM staffing_requests WHERE batch_id = 'cb400000-0000-0000-0000-000000000001'),
          2::bigint, 'real constraints permit a frozen multi-date availability batch');
SELECT throws_ok($$
  INSERT INTO staffing_requests (job_id, profile_id, phase, status, single_day, target_date, token_hash, token_expires_at)
  VALUES ('cb210000-0000-0000-0000-000000000001', 'cb110000-0000-0000-0000-000000000001',
          'availability', 'pending', true, '2026-10-24', 'hash', now() + interval '48 hours'),
         ('cb210000-0000-0000-0000-000000000001', 'cb110000-0000-0000-0000-000000000001',
          'availability', 'pending', true, '2026-10-22', 'hash', now() + interval '48 hours')
$$, '23505', NULL, 'overlapping pending dates reject the entire insert');
SELECT is((SELECT count(*) FROM staffing_requests WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
           AND target_date = '2026-10-24'), 0::bigint, 'a collision leaves no partially inserted uncovered date');
INSERT INTO staffing_requests (id, job_id, profile_id, phase, status, single_day, target_date, token_hash, token_expires_at)
VALUES ('cb310000-0000-0000-0000-000000000003', 'cb210000-0000-0000-0000-000000000001',
        'cb110000-0000-0000-0000-000000000001', 'availability', 'pending', true, '2026-10-24', 'hash', now() + interval '48 hours'),
       ('cb310000-0000-0000-0000-000000000004', 'cb210000-0000-0000-0000-000000000001',
        'cb110000-0000-0000-0000-000000000001', 'offer', 'pending', true, '2026-10-22', 'hash', now() + interval '48 hours');
SELECT is((SELECT count(*) FROM staffing_requests WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
           AND phase = 'availability' AND status = 'pending'), 3::bigint, 'an added date can have its own availability cycle');
SELECT is((SELECT count(*) FROM staffing_requests WHERE job_id = 'cb210000-0000-0000-0000-000000000001'
           AND target_date = '2026-10-22' AND status = 'pending'), 2::bigint, 'availability and offer retain separate phase identity');
UPDATE staffing_requests SET status = 'declined' WHERE id = 'cb310000-0000-0000-0000-000000000002';
UPDATE staffing_requests SET status = 'confirmed'
WHERE batch_id = 'cb400000-0000-0000-0000-000000000001'
  AND job_id = 'cb210000-0000-0000-0000-000000000001'
  AND profile_id = 'cb110000-0000-0000-0000-000000000001' AND phase = 'availability' AND status = 'pending';
SELECT is((SELECT status FROM staffing_requests WHERE id = 'cb310000-0000-0000-0000-000000000001'),
          'confirmed', 'batch response confirms its matching pending row');
SELECT is((SELECT status FROM staffing_requests WHERE id = 'cb310000-0000-0000-0000-000000000002'),
          'declined', 'batch response cannot change an already declined row');
SELECT ok((SELECT bool_and(status = 'pending') FROM staffing_requests
           WHERE id IN ('cb310000-0000-0000-0000-000000000003', 'cb310000-0000-0000-0000-000000000004')),
          'responding to the original batch leaves added-date and other-phase cycles pending');
SELECT * FROM finish();
ROLLBACK;
