-- Materialized view to aggregate staffing and cost data per job
-- Refresh as needed after assignment/timesheet changes

CREATE MATERIALIZED VIEW IF NOT EXISTS public.v_job_staffing_summary AS
SELECT 
  j.id AS job_id,
  j.title,
  j.job_type,
  COUNT(ja.*) FILTER (WHERE ja.status IS NOT NULL) AS assigned_count,
  COUNT(DISTINCT t.technician_id) AS worked_count,
  COALESCE(SUM(t.amount_eur), 0) AS total_cost_eur,
  COALESCE(SUM(CASE WHEN t.status = 'approved' THEN t.amount_eur ELSE 0 END), 0) AS approved_cost_eur
FROM public.jobs j
LEFT JOIN public.job_assignments ja ON ja.job_id = j.id
LEFT JOIN public.timesheets t ON t.job_id = j.id AND (t.is_schedule_only IS NOT TRUE)
GROUP BY j.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_job_staffing_summary_job_id ON public.v_job_staffing_summary(job_id);

-- Helper function to refresh the view; can be invoked from triggers or scheduled jobs
CREATE OR REPLACE FUNCTION public.refresh_v_job_staffing_summary()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_job_staffing_summary;
$$;

GRANT SELECT ON public.v_job_staffing_summary TO anon;
GRANT SELECT ON public.v_job_staffing_summary TO authenticated;
GRANT SELECT ON public.v_job_staffing_summary TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_v_job_staffing_summary() TO anon;
GRANT EXECUTE ON FUNCTION public.refresh_v_job_staffing_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_v_job_staffing_summary() TO service_role;
