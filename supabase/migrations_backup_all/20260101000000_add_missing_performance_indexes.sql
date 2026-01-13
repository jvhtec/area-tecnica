-- =============================================================================
-- ADD MISSING PERFORMANCE INDEXES
-- =============================================================================
-- Complements 20251217000000_performance_optimization.sql with indexes that are
-- referenced frequently by the matrix/availability queries and timesheet joins.
-- =============================================================================

-- Availability schedules: frequently queried by (user_id, date) range
CREATE INDEX IF NOT EXISTS idx_availability_schedules_user_date
  ON public.availability_schedules (user_id, date);

-- Vacation requests: overlap checks scoped per technician (commonly only for approved)
CREATE INDEX IF NOT EXISTS idx_vacation_requests_approved_tech_date_range
  ON public.vacation_requests (technician_id, start_date, end_date)
  WHERE status = 'approved';

-- Timesheets: frequent joins/lookups by job + technician + date
CREATE INDEX IF NOT EXISTS idx_timesheets_job_tech_date
  ON public.timesheets (job_id, technician_id, date);

