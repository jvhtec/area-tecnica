-- DB-06: reconcile actual replay/live catalog differences without widening access.
-- Production already removed these non-CRUD privileges. Preserve that hardening
-- on fresh installs too; extension-owned objects are not application managed.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
-- Schema-scoped defaults cannot subtract the global PUBLIC EXECUTE default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $reconcile$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT c.oid::regclass AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM anon, authenticated', relation.name);
  END LOOP;
END;
$reconcile$;

ALTER VIEW public.v_truck_planner_technician_published_plans SET (security_invoker = true);

-- Restore the missing attribution trigger. It only edits NEW and needs no
-- elevated privileges. Existing explicit attribution and old rows are untouched.
CREATE OR REPLACE FUNCTION public.set_job_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_job_created_by() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_job_created_by() TO service_role;
DROP TRIGGER IF EXISTS trg_jobs_set_created_by ON public.jobs;
CREATE TRIGGER trg_jobs_set_created_by BEFORE INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.set_job_created_by();

-- The live achievement function differs only in formatting/comment text.
-- Canonicalize both environments with identical behavior and pinned search_path.
CREATE OR REPLACE FUNCTION public.trigger_evaluate_achievements_on_job_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_tech_id uuid;
BEGIN
  IF NEW.status = 'Completado' AND (OLD.status IS DISTINCT FROM 'Completado') THEN
    FOR v_tech_id IN
      SELECT DISTINCT technician_id
      FROM job_assignments
      WHERE job_id = NEW.id AND status = 'confirmed'
    LOOP
      PERFORM evaluate_user_achievements(v_tech_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
