-- Auto-set created_by on jobs table when not explicitly provided.
-- Uses SECURITY DEFINER: auth.uid() works in the caller's context in Supabase,
-- and BEFORE INSERT triggers run within the authenticated session.
CREATE OR REPLACE FUNCTION set_job_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_set_created_by ON jobs;
-- Backfill: set created_by for jobs where it's currently null and we can determine the creator
-- UPDATE jobs SET created_by = <known_user_id> WHERE id = <job_id> AND created_by IS NULL;
CREATE TRIGGER trg_jobs_set_created_by
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_job_created_by();

-- NOTE: Older jobs (before this migration) will retain NULL created_by
-- as the original creator cannot be determined retroactively.
