-- Regression tests for create_timesheets_for_assignment schedule metadata
BEGIN;

DO $$
DECLARE
    payroll_job_id uuid := gen_random_uuid();
    schedule_job_id uuid := gen_random_uuid();
    payroll_tech_id uuid := gen_random_uuid();
    schedule_tech_id uuid := gen_random_uuid();
    assigner_id uuid := gen_random_uuid();
BEGIN
    -- Seed lightweight technician and assigner profiles
    INSERT INTO profiles (id, email, role, department, assignable_as_tech)
    VALUES
        (payroll_tech_id, 'payroll-tech-' || payroll_job_id || '@example.com', 'technician', 'sound', true),
        (schedule_tech_id, 'schedule-tech-' || schedule_job_id || '@example.com', 'technician', 'sound', true),
        (assigner_id, 'assigner-' || assigner_id || '@example.com', 'management', 'sound', false);

    -- Standard single job spanning three days
    INSERT INTO jobs (id, title, start_time, end_time, job_type, status, color, rates_approved)
    VALUES (
        payroll_job_id,
        'Payroll Job',
        '2025-06-01 09:00:00+00',
        '2025-06-03 18:00:00+00',
        'single',
        'Tentativa',
        '#0044ff',
        false
    );

    INSERT INTO job_assignments (job_id, technician_id, single_day, assignment_date, assigned_by)
    VALUES (payroll_job_id, payroll_tech_id, false, NULL, assigner_id);

    IF (SELECT COUNT(*) FROM timesheets WHERE job_id = payroll_job_id AND technician_id = payroll_tech_id) != 3 THEN
        RAISE EXCEPTION 'Payroll job should create one timesheet per job date';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timesheets
        WHERE job_id = payroll_job_id
          AND technician_id = payroll_tech_id
          AND is_schedule_only = true
    ) THEN
        RAISE EXCEPTION 'Payroll job timesheets must not be schedule-only';
    END IF;

    -- Dryhire single-day assignment should still materialize in timesheets but be schedule-only
    INSERT INTO jobs (id, title, start_time, end_time, job_type, status, color, rates_approved)
    VALUES (
        schedule_job_id,
        'Dryhire Job',
        '2025-07-04 08:00:00+00',
        '2025-07-04 23:00:00+00',
        'dryhire',
        'Tentativa',
        '#ff8800',
        false
    );

    INSERT INTO job_assignments (job_id, technician_id, single_day, assignment_date, assigned_by)
    VALUES (schedule_job_id, schedule_tech_id, true, '2025-07-04', assigner_id);

    IF NOT EXISTS (
        SELECT 1
        FROM timesheets
        WHERE job_id = schedule_job_id
          AND technician_id = schedule_tech_id
          AND date = '2025-07-04'
          AND is_schedule_only = true
    ) THEN
        RAISE EXCEPTION 'Dryhire single-day assignments must create schedule-only rows';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timesheets
        WHERE job_id = schedule_job_id
          AND technician_id = schedule_tech_id
          AND is_schedule_only = false
    ) THEN
        RAISE EXCEPTION 'Dryhire assignments should never produce payroll rows';
    END IF;

    -- Clean up test data so the script is idempotent
    DELETE FROM timesheets WHERE job_id IN (payroll_job_id, schedule_job_id);
    DELETE FROM job_assignments WHERE job_id IN (payroll_job_id, schedule_job_id);
    DELETE FROM jobs WHERE id IN (payroll_job_id, schedule_job_id);
    DELETE FROM profiles WHERE id IN (payroll_tech_id, schedule_tech_id, assigner_id);
END $$;

COMMIT;
