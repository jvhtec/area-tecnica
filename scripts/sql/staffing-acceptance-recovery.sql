-- Read-only management triage. Run against the intended environment after rollout.
-- Membership counting retains campaign semantics: any non-declined membership.
-- Known target_date checks cover single/batch rows; legacy consent needs inspection.
SELECT sr.id, sr.job_id, sr.profile_id, sr.target_date, sr.updated_at,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = sr.job_id AND ja.technician_id = sr.profile_id AND ja.status <> 'declined'
  ) THEN 'missing_membership' ELSE 'missing_known_date' END AS reason
FROM public.staffing_requests sr
JOIN public.jobs j ON j.id = sr.job_id
WHERE sr.phase = 'offer' AND sr.status = 'confirmed'
  AND sr.updated_at > now() - interval '7 days'
  AND (
    NOT EXISTS (SELECT 1 FROM public.job_assignments ja
      WHERE ja.job_id = sr.job_id AND ja.technician_id = sr.profile_id AND ja.status <> 'declined')
    OR (j.job_type <> 'dryhire' AND sr.target_date IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.timesheets ts WHERE ts.job_id = sr.job_id
        AND ts.technician_id = sr.profile_id AND ts.date = sr.target_date AND ts.is_active
    ))
  )
ORDER BY sr.updated_at DESC;

-- One attempt can emit both error events. Count distinct requests, not events.
-- A manager may already have recovered it: failures are triage, not retry commands.
SELECT se.staffing_request_id, max(se.created_at) AS latest_failure,
  array_agg(DISTINCT se.event ORDER BY se.event) AS failure_events
FROM public.staffing_events se
JOIN public.staffing_requests sr ON sr.id = se.staffing_request_id
WHERE se.event IN ('auto_assign_upsert_error', 'auto_assign_error', 'auto_assign_skipped_conflict')
  AND se.created_at > now() - interval '7 days'
  AND sr.phase = 'offer' AND sr.status = 'confirmed'
GROUP BY se.staffing_request_id
ORDER BY latest_failure DESC;
