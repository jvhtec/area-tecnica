-- Add override fields to v_tour_job_rate_quotes_2025 view
-- This allows PDFs and emails to show when an override is active and what the calculated amount was

-- Drop existing view
drop view if exists v_tour_job_rate_quotes_2025;

-- Recreate view with override fields
-- Note: autonomo_discount_eur is extracted from breakdown jsonb if not available at top level
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
  -- Extract autonomo_discount_eur from breakdown if it exists there
  CASE
    WHEN base.breakdown ? 'autonomo_discount' THEN (base.breakdown->>'autonomo_discount')::numeric
    ELSE NULL
  END as autonomo_discount_eur,
  -- Override fields
  (overrides.override_amount_eur is not null) as has_override,
  overrides.override_amount_eur,
  base.total_eur as calculated_total_eur,
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

comment on view v_tour_job_rate_quotes_2025 is 'Tour job rate quotes with manual payout override support. Includes has_override flag, override_amount_eur, and calculated_total_eur for PDF/email display.';
