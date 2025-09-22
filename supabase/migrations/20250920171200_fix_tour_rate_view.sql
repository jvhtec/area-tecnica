-- Recreate view without RLS policy attempts; rely on auth.uid() filtering
DROP VIEW IF EXISTS v_tour_job_rate_quotes_2025;

CREATE OR REPLACE VIEW v_tour_job_rate_quotes_2025 AS
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
  (q->>'iso_year')::int AS iso_year,
  (q->>'iso_week')::int AS iso_week,
  (q->>'total_eur')::numeric AS total_eur,
  (q->>'extras_total_eur')::numeric AS extras_total_eur,
  (q->>'total_with_extras_eur')::numeric AS total_with_extras_eur,
  q AS breakdown
FROM job_assignments a
JOIN jobs j ON j.id = a.job_id AND j.job_type = 'tourdate'
CROSS JOIN LATERAL compute_tour_job_rate_quote_2025(a.job_id, a.technician_id) q
WHERE a.technician_id = auth.uid();

GRANT SELECT ON v_tour_job_rate_quotes_2025 TO authenticated, service_role;
