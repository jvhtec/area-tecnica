-- Update v_job_tech_payout_2025 view to include override amounts
-- This ensures PDFs and emails reflect the override totals

-- First, drop the existing view if it exists
drop view if exists v_job_tech_payout_2025_with_overrides;

-- Create a new view that wraps the existing view and adds override logic
create or replace view v_job_tech_payout_2025_with_overrides as
select
  base.job_id,
  base.technician_id,
  base.timesheets_total_eur,
  base.extras_total_eur,
  base.extras_breakdown,
  base.vehicle_disclaimer,
  base.vehicle_disclaimer_text,
  -- Use override amount if exists, otherwise use the original calculated total
  coalesce(overrides.override_amount_eur, base.total_eur) as total_eur
from v_job_tech_payout_2025 base
left join job_technician_payout_overrides overrides
  on overrides.job_id = base.job_id
  and overrides.technician_id = base.technician_id;

-- Now replace the original view with the one that includes overrides
drop view if exists v_job_tech_payout_2025;

create view v_job_tech_payout_2025 as
select
  job_id,
  technician_id,
  timesheets_total_eur,
  extras_total_eur,
  extras_breakdown,
  vehicle_disclaimer,
  vehicle_disclaimer_text,
  total_eur
from v_job_tech_payout_2025_with_overrides;

-- Grant appropriate permissions
grant select on v_job_tech_payout_2025 to authenticated;
grant select on v_job_tech_payout_2025 to service_role;
grant select on v_job_tech_payout_2025_with_overrides to authenticated;
grant select on v_job_tech_payout_2025_with_overrides to service_role;
