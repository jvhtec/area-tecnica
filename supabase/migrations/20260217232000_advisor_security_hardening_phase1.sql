-- =============================================================================
-- Supabase Advisor Security Hardening - Phase 1
-- =============================================================================
-- Targets high-confidence fixes with minimal behavior risk:
-- 1) Remove SECURITY DEFINER behavior from view v_tour_job_rate_quotes_2025
-- 2) Set explicit search_path on advisor-flagged functions
-- 3) Replace permissive INSERT policies on feedback tables
-- =============================================================================

-- 1) Ensure the view executes with invoker rights.
ALTER VIEW IF EXISTS public.v_tour_job_rate_quotes_2025
  SET (security_invoker = true);

-- 2) Lock down function search_path for advisor-flagged functions.
ALTER FUNCTION public.cascade_tour_cancellation()
  SET search_path = public;

ALTER FUNCTION public.trigger_evaluate_achievements_on_job_complete()
  SET search_path = public;

ALTER FUNCTION public.is_madrid_working_day(text)
  SET search_path = public;

ALTER FUNCTION public.get_madrid_holidays(integer)
  SET search_path = public;

ALTER FUNCTION public.update_job_stage_plots_updated_at()
  SET search_path = public;

ALTER FUNCTION public.distance_km(double precision, double precision, double precision, double precision)
  SET search_path = public;

ALTER FUNCTION public.evaluate_user_achievements(uuid)
  SET search_path = public;

ALTER FUNCTION public.trigger_campaign_wake_up()
  SET search_path = public;

ALTER FUNCTION public.get_campaigns_to_tick(integer)
  SET search_path = public;

ALTER FUNCTION public.evaluate_daily_achievements()
  SET search_path = public;

-- 3) Harden public feedback INSERT policies.
-- Keep anonymous submissions possible while preventing created_by spoofing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bug_reports'
      AND policyname = 'p_bug_reports_public_insert_be3a30'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "p_bug_reports_public_insert_be3a30"
      ON public.bug_reports
      WITH CHECK (
        nullif(trim(reporter_email), '') IS NOT NULL
        AND (
          ((select auth.uid()) IS NULL AND created_by IS NULL)
          OR ((select auth.uid()) IS NOT NULL AND created_by = (select auth.uid()))
        )
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feature_requests'
      AND policyname = 'p_feature_requests_public_insert_b902da'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "p_feature_requests_public_insert_b902da"
      ON public.feature_requests
      WITH CHECK (
        nullif(trim(reporter_email), '') IS NOT NULL
        AND (
          ((select auth.uid()) IS NULL AND created_by IS NULL)
          OR ((select auth.uid()) IS NOT NULL AND created_by = (select auth.uid()))
        )
      )
    $stmt$;
  END IF;
END
$$;
