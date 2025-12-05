-- Update v_tour_job_rate_quotes_2025 view to include override amounts
-- This ensures tour date PDFs and emails reflect the override totals

-- First, drop the existing view if it exists
drop view if exists v_tour_job_rate_quotes_2025_with_overrides;

-- Create a new view that wraps the existing view and adds override logic
create or replace view v_tour_job_rate_quotes_2025_with_overrides as
select
  base.job_id,
  base.technician_id,
  base.title,
  base.start_time,
  base.end_time,
  base.tour_id,
  base.job_type,
  base.category,
  base.is_house_tech,
  base.is_tour_team_member,
  base.base_day_eur,
  base.week_count,
  base.multiplier,
  base.per_job_multiplier,
  base.iso_year,
  base.iso_week,
  base.extras,
  base.extras_total_eur,
  base.vehicle_disclaimer,
  base.vehicle_disclaimer_text,
  base.breakdown,
  -- Use override amount if exists, otherwise use the original calculated totals
  coalesce(overrides.override_amount_eur, base.total_eur) as total_eur,
  coalesce(overrides.override_amount_eur, base.total_with_extras_eur) as total_with_extras_eur
from v_tour_job_rate_quotes_2025 base
left join job_technician_payout_overrides overrides
  on overrides.job_id = base.job_id
  and overrides.technician_id = base.technician_id;

-- Now replace the original view with the one that includes overrides
drop view if exists v_tour_job_rate_quotes_2025;

create view v_tour_job_rate_quotes_2025 as
select
  job_id,
  technician_id,
  title,
  start_time,
  end_time,
  tour_id,
  job_type,
  category,
  is_house_tech,
  is_tour_team_member,
  base_day_eur,
  week_count,
  multiplier,
  per_job_multiplier,
  iso_year,
  iso_week,
  extras,
  extras_total_eur,
  vehicle_disclaimer,
  vehicle_disclaimer_text,
  breakdown,
  total_eur,
  total_with_extras_eur
from v_tour_job_rate_quotes_2025_with_overrides;

-- Grant appropriate permissions
grant select on v_tour_job_rate_quotes_2025 to authenticated;
grant select on v_tour_job_rate_quotes_2025 to service_role;
grant select on v_tour_job_rate_quotes_2025_with_overrides to authenticated;
grant select on v_tour_job_rate_quotes_2025_with_overrides to service_role;
