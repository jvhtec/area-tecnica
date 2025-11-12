-- Fix security linter issues:
-- 1. Remove SECURITY DEFINER from views (if present)
-- 2. Ensure RLS is enabled on corporate_email_logs

-- Fix job_required_roles_summary view - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.job_required_roles_summary;

CREATE VIEW public.job_required_roles_summary AS
SELECT
  job_id,
  department,
  sum(quantity) as total_required,
  jsonb_agg(
    jsonb_build_object(
      'role_code', role_code,
      'quantity', quantity,
      'notes', notes
    )
    order by role_code
  ) as roles
FROM public.job_required_roles
GROUP BY job_id, department;

GRANT SELECT ON public.job_required_roles_summary TO authenticated, service_role;

-- Fix v_tour_job_rate_quotes_2025 view - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_tour_job_rate_quotes_2025;

CREATE VIEW public.v_tour_job_rate_quotes_2025 AS
SELECT
  a.job_id,
  a.technician_id,
  j.start_time,
  j.end_time,
  j.job_type,
  j.tour_id,
  j.title,
  (q->>'is_house_tech')::boolean AS is_house_tech,
  (q->>'is_tour_team_member')::boolean AS is_tour_team_member,
  (q->>'category') AS category,
  (q->>'base_day_eur')::numeric AS base_day_eur,
  (q->>'week_count')::int AS week_count,
  (q->>'multiplier')::numeric AS multiplier,
  (q->>'per_job_multiplier')::numeric AS per_job_multiplier,
  (q->>'iso_year')::int AS iso_year,
  (q->>'iso_week')::int AS iso_week,
  (q->>'total_eur')::numeric AS total_eur,
  (q->>'extras_total_eur')::numeric AS extras_total_eur,
  (q->>'total_with_extras_eur')::numeric AS total_with_extras_eur,
  (q->>'vehicle_disclaimer')::boolean AS vehicle_disclaimer,
  (q->>'vehicle_disclaimer_text') AS vehicle_disclaimer_text,
  (q->'extras') AS extras,
  q AS breakdown
FROM job_assignments a
JOIN jobs j ON j.id = a.job_id AND j.job_type = 'tourdate'
CROSS JOIN LATERAL compute_tour_job_rate_quote_2025(a.job_id, a.technician_id) q
WHERE a.technician_id = auth.uid();

GRANT SELECT ON public.v_tour_job_rate_quotes_2025 TO authenticated, service_role;

-- Ensure RLS is enabled on corporate_email_logs table
ALTER TABLE public.corporate_email_logs ENABLE ROW LEVEL SECURITY;

-- Add comment documenting the fix
COMMENT ON VIEW public.job_required_roles_summary IS 'Aggregated view for job required roles (security definer removed for compliance)';
COMMENT ON VIEW public.v_tour_job_rate_quotes_2025 IS 'Tour job rate quotes for 2025 (security definer removed for compliance)';
