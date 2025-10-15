-- =====================================================
-- SECURITY FIX: Set Views to Use Caller's Privileges
-- =====================================================
-- Issue: Views owned by postgres superuser bypass RLS policies
-- Solution: Set security_invoker = true to use caller's privileges
-- This makes views respect the RLS policies on underlying tables

-- =====================================================
-- Set security_invoker = true on all views
-- =====================================================
-- This tells PostgreSQL to execute the view with the privileges
-- of the user calling it, not the view owner (postgres superuser)

ALTER VIEW current_stock_levels SET (security_invoker = true);
ALTER VIEW equipment_availability_with_rentals SET (security_invoker = true);
ALTER VIEW v_job_tech_payout_2025 SET (security_invoker = true);
ALTER VIEW v_tour_job_rate_quotes_2025 SET (security_invoker = true);
ALTER VIEW wallboard_doc_counts SET (security_invoker = true);
ALTER VIEW wallboard_doc_requirements SET (security_invoker = true);
ALTER VIEW wallboard_profiles SET (security_invoker = true);
ALTER VIEW wallboard_timesheet_status SET (security_invoker = true);

-- Also set security_barrier for additional protection
ALTER VIEW current_stock_levels SET (security_barrier = true);
ALTER VIEW equipment_availability_with_rentals SET (security_barrier = true);
ALTER VIEW v_job_tech_payout_2025 SET (security_barrier = true);
ALTER VIEW v_tour_job_rate_quotes_2025 SET (security_barrier = true);
ALTER VIEW wallboard_doc_counts SET (security_barrier = true);
ALTER VIEW wallboard_doc_requirements SET (security_barrier = true);
ALTER VIEW wallboard_profiles SET (security_barrier = true);
ALTER VIEW wallboard_timesheet_status SET (security_barrier = true);

-- =====================================================
-- SECURITY VERIFICATION
-- =====================================================
-- The following documents the security improvement:
--
-- BEFORE:
-- - Views executed with postgres superuser privileges (security_definer behavior)
-- - Views bypassed RLS policies on underlying tables
-- - Any authenticated user could query views and see all data
--
-- AFTER:
-- - Views execute with the caller's privileges (security_invoker = true)
-- - Views now respect RLS policies on underlying tables
-- - Users only see data their role permits via existing RLS policies
--
-- Examples of protection now in place:
-- - Equipment views: Users see only their department (via equipment table RLS)
-- - Payment views: Technicians see only own data (via timesheets table RLS)
-- - Wallboard views: Restricted by job_assignments and profiles RLS
--
-- This prevents unauthorized access to sensitive financial and operational data
-- without requiring separate RLS policies on the views themselves