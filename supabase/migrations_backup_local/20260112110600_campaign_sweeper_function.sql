-- Function to get campaigns ready for tick (called by sweeper)
CREATE OR REPLACE FUNCTION get_campaigns_to_tick(p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  department text,
  mode text,
  status text,
  policy jsonb,
  next_run_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.job_id,
    sc.department,
    sc.mode,
    sc.status,
    sc.policy,
    sc.next_run_at
  FROM staffing_campaigns sc
  WHERE
    sc.status = 'active'
    AND sc.next_run_at IS NOT NULL
    AND sc.next_run_at <= now()
    AND sc.run_lock IS NULL
  ORDER BY sc.next_run_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
