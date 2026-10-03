-- Test-only: execute exclusively through the labelled disposable clone harness.
-- The application/RPC functions and their authorization remain unchanged.
BEGIN;
CREATE SCHEMA local_matrix_fault;
COMMENT ON SCHEMA local_matrix_fault IS '__OWNED_MARKER__';
REVOKE ALL ON SCHEMA local_matrix_fault FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE local_matrix_fault.owned_dates (
  job_id uuid NOT NULL, technician_id uuid NOT NULL, caller_id uuid NOT NULL,
  fail_date date NOT NULL, marker text NOT NULL,
  PRIMARY KEY (job_id, technician_id, fail_date)
);
ALTER TABLE local_matrix_fault.owned_dates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON local_matrix_fault.owned_dates FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION local_matrix_fault.reject_owned_date() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $guard$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM local_matrix_fault.owned_dates f JOIN public.jobs j ON j.id = f.job_id
    WHERE f.job_id = NEW.job_id AND f.technician_id = NEW.technician_id
      AND f.fail_date = NEW.date AND f.caller_id = auth.uid() AND j.title = f.marker
      AND f.marker ~ '^\[LOCAL CAMPAIGN TEST [a-f0-9-]{36}\]$'
  ) THEN
    RAISE EXCEPTION 'LOCAL_MATRIX_OWNED_DATE_FAILURE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION local_matrix_fault.reject_owned_date() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER local_matrix_owned_date_failure BEFORE INSERT OR UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION local_matrix_fault.reject_owned_date();
COMMIT;
