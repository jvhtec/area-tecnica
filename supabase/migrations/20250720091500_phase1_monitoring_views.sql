-- Phase 1.2 – Monitoring views & alerts
-- Adds observability helpers built on pg_stat_statements + production tables.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE VIEW IF NOT EXISTS slow_queries_timesheets AS
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query ~* '\\b(from|join)\\s+timesheets\\b'
  AND mean_exec_time > 100
ORDER BY mean_exec_time DESC;

CREATE VIEW IF NOT EXISTS data_anomalies AS
SELECT
  'timesheets' AS table_name,
  'missing_times' AS anomaly,
  COUNT(*) AS count
FROM timesheets
WHERE status != 'draft' AND (start_time IS NULL OR end_time IS NULL)
UNION ALL
SELECT
  'job_assignments' AS table_name,
  'missing_roles' AS anomaly,
  COUNT(*) AS count
FROM job_assignments
WHERE sound_role IS NULL AND lights_role IS NULL AND video_role IS NULL;

CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT
  'timesheet' AS type,
  status AS action,
  COUNT(*) AS count,
  MAX(updated_at) AS last_activity
FROM timesheets
WHERE updated_at > now() - interval '1 hour'
GROUP BY status
UNION ALL
SELECT
  'assignment' AS type,
  'created' AS action,
  COUNT(*) AS count,
  MAX(assigned_at) AS last_activity
FROM job_assignments
WHERE assigned_at > now() - interval '1 hour';
