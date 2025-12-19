-- =============================================================================
-- LOCK DOWN v_job_staffing_summary PRIVILEGES (SECURITY)
-- =============================================================================
-- Keep authenticated SELECT temporarily (backwards compatibility), but remove
-- any write privileges from anon/authenticated.
-- =============================================================================

REVOKE ALL ON TABLE public.v_job_staffing_summary FROM anon;
REVOKE ALL ON TABLE public.v_job_staffing_summary FROM authenticated;
GRANT SELECT ON TABLE public.v_job_staffing_summary TO authenticated;

