\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT ok(to_regprocedure('public.assign_staffing_offer(uuid,date[],boolean,text)') IS NOT NULL, 'atomic staffing command exists');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.assign_staffing_offer(uuid,date[],boolean,text)'::regprocedure), 'command uses invoker privileges');
SELECT ok(NOT has_function_privilege('anon', 'public.assign_staffing_offer(uuid,date[],boolean,text)', 'EXECUTE'), 'anonymous clients cannot assign');
SELECT ok(NOT has_function_privilege('authenticated', 'public.assign_staffing_offer(uuid,date[],boolean,text)', 'EXECUTE'), 'authenticated clients cannot assign directly');
SELECT ok(has_function_privilege('service_role', 'public.assign_staffing_offer(uuid,date[],boolean,text)', 'EXECUTE'), 'service role can assign');
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('cc110000-0000-0000-0000-000000000001', 'atomic-tech@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO profiles (id, email, first_name, last_name, role, department)
VALUES ('cc110000-0000-0000-0000-000000000001', 'atomic-tech@test.local', 'Atomic', 'Tech', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'timesheet.approved']) code
ON CONFLICT (code) DO NOTHING;
INSERT INTO jobs (id, title, start_time, end_time, job_type, status)
VALUES ('cc210000-0000-0000-0000-000000000001', 'Atomic staffing', '2026-10-20 08:00:00+02', '2026-10-24 20:00:00+02', 'single', 'Confirmado'),
       ('cc210000-0000-0000-0000-000000000002', 'Atomic dryhire', '2026-10-20 08:00:00+02', '2026-10-24 20:00:00+02', 'dryhire', 'Confirmado'),
       ('cc210000-0000-0000-0000-000000000003', 'Atomic tourdate', '2026-10-20 08:00:00+02', '2026-10-24 20:00:00+02', 'tourdate', 'Confirmado');
INSERT INTO job_date_types (job_id, date, type) VALUES ('cc210000-0000-0000-0000-000000000001', '2026-10-20', 'prep_day');
INSERT INTO staffing_requests (id, job_id, profile_id, phase, status, token_hash, token_expires_at)
SELECT ('cc310000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('cc210000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'cc110000-0000-0000-0000-000000000001', 'offer', 'confirmed', 'hash', now() + interval '48 hours'
FROM generate_series(1, 3) n;

-- Fail on the last accepted day after the membership and prep-trigger writes.
CREATE FUNCTION pg_temp.fail_staffing_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_id = 'cc210000-0000-0000-0000-000000000001' AND NEW.date::text = current_setting('staffing_test.fail_date', true) THEN
    RAISE EXCEPTION 'injected schedule failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staffing_test_fail_schedule BEFORE INSERT OR UPDATE ON timesheets FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_staffing_schedule();
SELECT set_config('staffing_test.fail_date', '2026-10-22', true);
SELECT throws_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY['2026-10-20','2026-10-21','2026-10-22']::date[], false, 'SND-FOH-R') $$,
                 'P0001', 'injected schedule failure', 'schedule failure propagates');
SELECT is((SELECT count(*) FROM job_assignments WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), 0::bigint, 'new membership rolls back');
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), 0::bigint, 'all schedule rows including prep-trigger effects roll back');
SELECT is((SELECT status FROM staffing_requests WHERE id = 'cc310000-0000-0000-0000-000000000001'), 'confirmed', 'response remains confirmed after transaction failure');
SELECT set_config('staffing_test.fail_date', '', true);
SELECT lives_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY['2026-10-20']::date[], true, 'SND-FOH-R') $$, 'accepted single day commits');
UPDATE timesheets SET notes = 'Approved preparation', approved_by_manager = true, signature_data = 'signature', start_time = '09:00', end_time = '17:00'
WHERE job_id = 'cc210000-0000-0000-0000-000000000001';
CREATE TEMP TABLE original_membership AS SELECT to_jsonb(a) snapshot FROM job_assignments a WHERE job_id = 'cc210000-0000-0000-000000000001';
CREATE TEMP TABLE original_schedule AS SELECT to_jsonb(t) snapshot FROM timesheets t WHERE job_id = 'cc210000-0000-0000-0000-000000000001';
SELECT set_config('staffing_test.fail_date', '2026-10-22', true);
SELECT throws_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY['2026-10-21','2026-10-22']::date[], false, 'SND-MON-R') $$,
                 'P0001', 'injected schedule failure', 'extension failure propagates');
SELECT is((SELECT to_jsonb(a) FROM job_assignments a WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), (SELECT snapshot FROM original_membership), 'failed extension restores every membership field');
SELECT is((SELECT jsonb_agg(to_jsonb(t)) FROM timesheets t WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), (SELECT jsonb_agg(snapshot) FROM original_schedule), 'failed extension preserves approved rows and appends nothing');
SELECT set_config('staffing_test.fail_date', '', true);
SELECT lives_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY['2026-10-22','2026-10-21','2026-10-21']::date[], false, 'SND-MON-R') $$, 'extension deduplicates and commits all accepted dates');
SELECT is((SELECT array_agg(date ORDER BY date)::text FROM timesheets WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), '{2026-10-20,2026-10-21,2026-10-22}', 'exact schedule coverage');
SELECT is((SELECT to_jsonb(t) FROM timesheets t WHERE job_id = 'cc210000-0000-0000-0000-000000000001' AND date = '2026-10-20'), (SELECT snapshot FROM original_schedule), 'approved prep row remains byte-for-byte unchanged');
SELECT ok((SELECT single_day AND assignment_date = '2026-10-20' FROM job_assignments WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), 'extension preserves membership scope');
SELECT lives_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY['2026-10-21','2026-10-22']::date[], false, 'SND-MON-R') $$, 'command replay succeeds');
SELECT is((SELECT count(*) FROM job_assignments WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), 1::bigint, 'replay retains one membership');
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'cc210000-0000-0000-0000-000000000001'), 3::bigint, 'replay retains one timesheet per date');
SELECT throws_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY[]::date[], false, NULL) $$, '22023', 'Valid accepted dates are required', 'empty non-dryhire schedule is rejected');
SELECT throws_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000001', ARRAY[NULL]::date[], false, NULL) $$, '22023', 'Valid accepted dates are required', 'null date is rejected');
SELECT lives_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000002', ARRAY['2026-10-20']::date[], true, 'SND-FOH-R') $$, 'dryhire membership commits');
SELECT is((SELECT count(*) FROM timesheets WHERE job_id = 'cc210000-0000-0000-0000-000000000002'), 0::bigint, 'dryhire keeps assignment-only contract');
SELECT lives_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000003', ARRAY['2026-10-20']::date[], true, 'SND-FOH-R') $$, 'tourdate commits');
SELECT ok((SELECT is_schedule_only AND is_active AND source = 'staffing' FROM timesheets WHERE job_id = 'cc210000-0000-0000-0000-000000000003'), 'tourdate creates schedule-only staffing timesheet');
UPDATE staffing_requests SET status = 'pending' WHERE id = 'cc310000-0000-0000-0000-000000000003';
SELECT throws_ok($$ SELECT assign_staffing_offer('cc310000-0000-0000-0000-000000000003', ARRAY['2026-10-21']::date[], true, NULL) $$, '22023', 'A confirmed offer response is required', 'unconfirmed requests cannot assign');
SELECT * FROM finish();
ROLLBACK;
