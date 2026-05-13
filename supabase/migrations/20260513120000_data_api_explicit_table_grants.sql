-- Explicit Data API grants for public tables that previously relied on
-- default privileges. RLS policies continue to control row-level access.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staffing_campaigns TO authenticated;
GRANT ALL ON TABLE public.staffing_campaigns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staffing_campaign_roles TO authenticated;
GRANT ALL ON TABLE public.staffing_campaign_roles TO service_role;

GRANT SELECT ON TABLE public.staffing_campaign_events TO authenticated;
GRANT ALL ON TABLE public.staffing_campaign_events TO service_role;

GRANT SELECT, INSERT, DELETE ON TABLE public.job_rehearsal_dates TO authenticated;
GRANT ALL ON TABLE public.job_rehearsal_dates TO service_role;

GRANT SELECT ON TABLE public.achievements TO authenticated;
GRANT ALL ON TABLE public.achievements TO service_role;

GRANT SELECT ON TABLE public.achievement_progress TO authenticated;
GRANT ALL ON TABLE public.achievement_progress TO service_role;

GRANT SELECT, UPDATE ON TABLE public.achievement_unlocks TO authenticated;
GRANT ALL ON TABLE public.achievement_unlocks TO service_role;
