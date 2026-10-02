-- Disposable PR989 review database ONLY. No production credentials or delivery.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('cb910000-0000-0000-0000-000000000001', 'rest-tech@test.local', '{}', '{}', 'authenticated', 'authenticated'),
       ('cb910000-0000-0000-0000-000000000002', 'rest-manager@test.local', '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false FROM unnest(ARRAY[
  'job.created', 'job.updated', 'job.deleted',
  'assignment.created', 'assignment.updated', 'assignment.removed',
  'staffing.offer.sent', 'staffing.offer.confirmed', 'staffing.offer.declined',
  'staffing.availability.sent', 'staffing.availability.confirmed', 'staffing.availability.declined',
  'timesheet.approved'
]) AS code
ON CONFLICT (code) DO NOTHING;

-- Failure/delay injection exists ONLY in this disposable test fixture.
CREATE TABLE IF NOT EXISTS public.staffing_test_faults (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  fail_date date,
  delay_assignment boolean NOT NULL DEFAULT false
);
ALTER TABLE public.staffing_test_faults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staffing_test_faults FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.staffing_test_faults TO service_role;
CREATE OR REPLACE FUNCTION public.staffing_test_schedule_fault() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staffing_test_faults WHERE job_id = NEW.job_id AND fail_date = NEW.date) THEN
    RAISE EXCEPTION 'injected schedule failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.staffing_test_assignment_delay() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staffing_test_faults WHERE job_id = NEW.job_id AND delay_assignment) THEN
    PERFORM pg_catalog.pg_sleep(0.3);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS staffing_test_schedule_fault ON public.timesheets;
CREATE TRIGGER staffing_test_schedule_fault BEFORE INSERT OR UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.staffing_test_schedule_fault();
DROP TRIGGER IF EXISTS staffing_test_assignment_delay ON public.job_assignments;
CREATE TRIGGER staffing_test_assignment_delay BEFORE INSERT OR UPDATE ON public.job_assignments
FOR EACH ROW EXECUTE FUNCTION public.staffing_test_assignment_delay();
NOTIFY pgrst, 'reload schema';
