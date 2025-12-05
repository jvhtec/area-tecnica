-- Update v_job_tech_payout_2025 view to include override amounts
-- This ensures PDFs and emails reflect the override totals

-- Step 1: Rename the existing view to a temporary name
alter view v_job_tech_payout_2025 rename to v_job_tech_payout_2025_base;

-- Step 2: Create the wrapper view that adds override logic
create view v_job_tech_payout_2025 as
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
from v_job_tech_payout_2025_base base
left join job_technician_payout_overrides overrides
  on overrides.job_id = base.job_id
  and overrides.technician_id = base.technician_id;

-- Grant appropriate permissions
grant select on v_job_tech_payout_2025 to authenticated;
grant select on v_job_tech_payout_2025 to service_role;
grant select on v_job_tech_payout_2025_base to authenticated;
grant select on v_job_tech_payout_2025_base to service_role;
