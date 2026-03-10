-- Update v_tour_job_rate_quotes_2025 view to include override amounts
-- This ensures tour date PDFs and emails reflect the override totals

-- Step 1: Rename the existing view to a temporary name
alter view v_tour_job_rate_quotes_2025 rename to v_tour_job_rate_quotes_2025_base;

-- Step 2: Create the wrapper view that adds override logic
create view v_tour_job_rate_quotes_2025 as
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
from v_tour_job_rate_quotes_2025_base base
left join job_technician_payout_overrides overrides
  on overrides.job_id = base.job_id
  and overrides.technician_id = base.technician_id;

-- Grant appropriate permissions
grant select on v_tour_job_rate_quotes_2025 to authenticated;
grant select on v_tour_job_rate_quotes_2025 to service_role;
grant select on v_tour_job_rate_quotes_2025_base to authenticated;
grant select on v_tour_job_rate_quotes_2025_base to service_role;
