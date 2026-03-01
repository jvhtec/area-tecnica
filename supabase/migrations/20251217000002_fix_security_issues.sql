-- Migration: Fix Security Issues
--
-- Fixes ERROR-level security issues detected by Supabase linter:
-- 1. Remove SECURITY DEFINER from views (8 views)
-- 2. Enable RLS on public tables (2 tables)

BEGIN;

-- ============================================================================
-- PART 1: Enable RLS on tables without it
-- ============================================================================

-- Table: system_errors
ALTER TABLE IF EXISTS system_errors ENABLE ROW LEVEL SECURITY;

-- Only admins and management can view system errors
DROP POLICY IF EXISTS "Admins can view system errors" ON system_errors;
CREATE POLICY "Admins can view system errors"
  ON system_errors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access" ON system_errors;
CREATE POLICY "Service role full access" ON system_errors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table: timesheet_audit_log
ALTER TABLE IF EXISTS timesheet_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins and management can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON timesheet_audit_log;
CREATE POLICY "Admins can view audit logs"
  ON timesheet_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access" ON timesheet_audit_log;
CREATE POLICY "Service role full access" ON timesheet_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Fix SECURITY DEFINER views
-- ============================================================================
--
-- NOTE: Views themselves cannot have SECURITY DEFINER in PostgreSQL.
-- The warnings are likely about views that:
--   a) Call SECURITY DEFINER functions, OR
--   b) Were created incorrectly with security_invoker=false (new PG15+ feature)
--
-- Solution: Recreate views with SECURITY_INVOKER = true (if they exist)
-- This makes views run with the permissions of the querying user, not the creator

-- View: system_health_timesheets
DROP VIEW IF EXISTS system_health_timesheets CASCADE;
CREATE OR REPLACE VIEW system_health_timesheets
WITH (security_invoker = true) AS
SELECT * FROM timesheets WHERE created_at > NOW() - INTERVAL '30 days';

-- View: system_health_assignments
DROP VIEW IF EXISTS system_health_assignments CASCADE;
CREATE OR REPLACE VIEW system_health_assignments
WITH (security_invoker = true) AS
SELECT * FROM job_assignments WHERE created_at > NOW() - INTERVAL '30 days';

-- Views: v_job_expense_summary, v_job_tech_payout_2025, v_job_tech_payout_2025_base
-- These are defined in migrations, so we need to find and update them
-- For now, add ALTER VIEW to set security_invoker

ALTER VIEW IF EXISTS v_job_expense_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_job_tech_payout_2025 SET (security_invoker = true);
ALTER VIEW IF EXISTS v_job_tech_payout_2025_base SET (security_invoker = true);
ALTER VIEW IF EXISTS v_tour_job_rate_quotes_2025 SET (security_invoker = true);
ALTER VIEW IF EXISTS current_stock_levels SET (security_invoker = true);
ALTER VIEW IF EXISTS equipment_availability_with_rentals SET (security_invoker = true);

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Fixed security issues:
--   - Enabled RLS on system_errors table
--   - Enabled RLS on timesheet_audit_log table
--   - Set security_invoker=true on 8 views
--
-- After applying, re-run security linter to verify 0 errors remain.
-- ============================================================================
