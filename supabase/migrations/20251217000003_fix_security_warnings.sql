-- Migration: Fix Security Warnings
--
-- Fixes WARN-level security issues that can be addressed via SQL:
-- 1. Add SET search_path to functions (23 functions)
-- 2. Move pg_net extension out of public schema
-- 3. Restrict materialized view API access

BEGIN;

-- ============================================================================
-- PART 1: Fix Function Search Path (23 functions)
-- ============================================================================
-- Adding SET search_path = public prevents search path injection attacks

-- Note: Most of these already have SET search_path, but linter may be detecting
-- functions created without it. We'll add it to any that are missing it.

-- Functions that need SET search_path added (if not already present)
ALTER FUNCTION IF EXISTS update_updated_at_column() SET search_path = public;
ALTER FUNCTION IF EXISTS manage_assignment_lifecycle(UUID, UUID, TEXT, TEXT, UUID, JSONB) SET search_path = public;
ALTER FUNCTION IF EXISTS acquire_assignment_lock(UUID, UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS get_billable_hours_for_job(UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS get_rate_for_evento_job(UUID, UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS find_orphaned_timesheets() SET search_path = public;
ALTER FUNCTION IF EXISTS find_double_bookings() SET search_path = public;
ALTER FUNCTION IF EXISTS find_declined_with_active_timesheets() SET search_path = public;
ALTER FUNCTION IF EXISTS delete_timesheets_on_assignment_removal() SET search_path = public;
ALTER FUNCTION IF EXISTS refresh_v_job_staffing_summary() SET search_path = public;
ALTER FUNCTION IF EXISTS validate_timesheet_status_transition() SET search_path = public;
ALTER FUNCTION IF EXISTS increment_timesheet_version() SET search_path = public;
ALTER FUNCTION IF EXISTS log_timesheet_changes() SET search_path = public;
ALTER FUNCTION IF EXISTS remove_assignment_with_timesheets(UUID, UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS json_diff_public(JSONB, JSONB) SET search_path = public;
ALTER FUNCTION IF EXISTS is_management_or_admin(UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS compute_timesheet_amount_2025(UUID, UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS set_technician_payout_override(UUID, UUID, NUMERIC) SET search_path = public;
ALTER FUNCTION IF EXISTS remove_technician_payout_override(UUID, UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS create_timesheets_for_assignment(UUID, UUID, DATE[]) SET search_path = public;
ALTER FUNCTION IF EXISTS check_technician_conflicts(UUID, DATE, DATE) SET search_path = public;

-- Dreamlit schema function (if it exists)
ALTER FUNCTION IF EXISTS dreamlit.send_supabase_auth_email(TEXT, TEXT, JSONB) SET search_path = public;

-- ============================================================================
-- PART 2: Move pg_net Extension (if in public schema)
-- ============================================================================
-- Extensions should not be in public schema to avoid naming conflicts

-- Check if pg_net is in public and move it to extensions schema
DO $$
BEGIN
  -- Create extensions schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS extensions;

  -- Move pg_net extension if it's in public
  IF EXISTS (
    SELECT 1 FROM pg_extension
    WHERE extname = 'pg_net'
    AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
    RAISE NOTICE 'Moved pg_net extension from public to extensions schema';
  END IF;
END $$;

-- ============================================================================
-- PART 3: Restrict Materialized View API Access
-- ============================================================================
-- Materialized views should not be directly accessible via PostgREST

-- Revoke public access from materialized view
REVOKE SELECT ON v_job_staffing_summary FROM anon;
REVOKE SELECT ON v_job_staffing_summary FROM authenticated;

-- Grant access only to specific roles that need it
GRANT SELECT ON v_job_staffing_summary TO service_role;

-- Add comment explaining the restriction
COMMENT ON MATERIALIZED VIEW v_job_staffing_summary IS
  'Internal materialized view - not exposed via PostgREST API. Access via RPC functions only.';

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Fixed security warnings:
--   - Added SET search_path to 23 functions
--   - Moved pg_net extension to extensions schema
--   - Restricted materialized view API access
--
-- Manual steps required (cannot be done via SQL):
--   1. Enable leaked password protection:
--      Dashboard → Authentication → Policies → Enable "Password compromise protection"
--
--   2. Upgrade Postgres version:
--      Dashboard → Settings → Infrastructure → Upgrade to latest version
--
-- ============================================================================
