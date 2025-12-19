-- =============================================================================
-- SET FUNCTION search_path (SECURITY)
-- =============================================================================
-- Fixes Supabase linter warnings: function_search_path_mutable
-- Strategy: set an explicit, safe search_path for public functions.
--
-- Using pg_catalog first prevents shadowing built-in functions.
-- =============================================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public;
ALTER FUNCTION public.acquire_assignment_lock(uuid, date) SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_billable_hours_for_job(uuid, numeric) SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_rate_for_evento_job(text, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.find_orphaned_timesheets() SET search_path = pg_catalog, public;
ALTER FUNCTION public.find_double_bookings() SET search_path = pg_catalog, public;
ALTER FUNCTION public.find_declined_with_active_timesheets() SET search_path = pg_catalog, public;
ALTER FUNCTION public.delete_timesheets_on_assignment_removal() SET search_path = pg_catalog, public;
ALTER FUNCTION public.refresh_v_job_staffing_summary() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_technician_payout_override(uuid, uuid, numeric) SET search_path = pg_catalog, public;
ALTER FUNCTION public.remove_technician_payout_override(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.find_policies_to_optimize() SET search_path = pg_catalog, public;
ALTER FUNCTION public.create_timesheets_for_assignment() SET search_path = pg_catalog, public;
ALTER FUNCTION public.check_technician_conflicts(uuid, uuid, date, boolean, boolean) SET search_path = pg_catalog, public;
ALTER FUNCTION public.increment_timesheet_version() SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_management_or_admin(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.json_diff_public(jsonb, jsonb, text[]) SET search_path = pg_catalog, public;
ALTER FUNCTION public.validate_timesheet_status_transition() SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_timesheet_changes() SET search_path = pg_catalog, public;

