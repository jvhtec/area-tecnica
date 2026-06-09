-- User deletion follow-up:
-- auth.admin.deleteUser() runs through GoTrue's database role while cascading
-- from auth.users -> profiles -> operational rows. Some DELETE triggers on
-- cascade targets perform cross-table cleanup with invoker privileges, which
-- can fail during the auth-driven cascade and surface only as a generic GoTrue
-- "Database error deleting user". Run those cleanup triggers as their function
-- owner with pinned search paths.

DO $$
BEGIN
  ALTER FUNCTION public.delete_timesheets_on_assignment_removal()
    SECURITY DEFINER
    SET search_path = pg_catalog, public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.cascade_delete_tour_assignment()
    SECURITY DEFINER
    SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.cleanup_tour_assignments_from_jobs()
    SECURITY DEFINER
    SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.trg_log_assignment_delete()
    SECURITY DEFINER
    SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.refresh_soundvision_file_review_stats()
    SECURITY DEFINER
    SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;
