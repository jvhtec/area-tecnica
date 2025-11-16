-- Phase 0.3 data audit queries (read-only)
-- Run with: \i docs/data_audit_phase0/phase0_data_audit.sql

\echo '1) Orphaned timesheets'
SELECT t.id, t.job_id, t.technician_id, t.created_at
FROM timesheets t
LEFT JOIN jobs j ON t.job_id = j.id
LEFT JOIN profiles p ON t.technician_id = p.id
WHERE j.id IS NULL OR p.id IS NULL;
-- \copy (above query) TO 'docs/data_audit_phase0/data_audit_orphaned_timesheets.csv' CSV HEADER

\echo '2) Orphaned assignments'
SELECT ja.id, ja.job_id, ja.technician_id, ja.assigned_at
FROM job_assignments ja
LEFT JOIN jobs j ON ja.job_id = j.id
LEFT JOIN profiles p ON ja.technician_id = p.id
WHERE j.id IS NULL OR p.id IS NULL;
-- \copy (above query) TO 'docs/data_audit_phase0/data_audit_orphaned_assignments.csv' CSV HEADER

\echo '3) Staffing requests without assignments'
SELECT COUNT(*) AS total, status, phase
FROM staffing_requests sr
WHERE status = 'confirmed'
  AND phase = 'offer'
  AND NOT EXISTS (
    SELECT 1 FROM job_assignments ja
    WHERE ja.job_id = sr.job_id
      AND ja.technician_id = sr.profile_id
  )
GROUP BY status, phase;
-- \copy (above query) TO 'docs/data_audit_phase0/data_audit_orphaned_staffing_requests.csv' CSV HEADER

\echo '4) Invalid role codes (compare manually against known_valid_role_codes.txt)'
SELECT DISTINCT sound_role AS role_code FROM job_assignments WHERE sound_role IS NOT NULL
UNION
SELECT DISTINCT lights_role FROM job_assignments WHERE lights_role IS NOT NULL
UNION
SELECT DISTINCT video_role FROM job_assignments WHERE video_role IS NOT NULL
ORDER BY role_code;

\echo '5) Assignment dates outside job range'
SELECT ja.id,
       ja.assignment_date,
       j.start_time,
       j.end_time
FROM job_assignments ja
JOIN jobs j ON ja.job_id = j.id
WHERE ja.single_day = true
  AND ja.assignment_date IS NOT NULL
  AND (ja.assignment_date < j.start_time::date OR ja.assignment_date > j.end_time::date);
-- \copy (above query) TO 'docs/data_audit_phase0/data_audit_invalid_dates.csv' CSV HEADER
