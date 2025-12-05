-- Update v_job_tech_payout_2025 view to include override amounts
-- This ensures PDFs and emails reflect the override totals

create or replace view v_job_tech_payout_2025 as
select
  base.job_id,
  base.technician_id,
  base.timesheets_total_eur,
  base.extras_total_eur,
  base.extras_breakdown,
  base.vehicle_disclaimer,
  base.vehicle_disclaimer_text,
  -- Use override amount if exists, otherwise use calculated total
  coalesce(overrides.override_amount_eur, base.calculated_total_eur) as total_eur
from (
  -- Base calculation (existing logic)
  select
    ja.job_id,
    ja.technician_id,
    coalesce(sum(ts.total_eur) filter (where ts.is_active = true), 0) as timesheets_total_eur,
    coalesce(
      sum(
        case
          when re.extra_type = 'travel_half' then coalesce(re.amount_override_eur, 150.0) * re.quantity
          when re.extra_type = 'travel_full' then coalesce(re.amount_override_eur, 300.0) * re.quantity
          when re.extra_type = 'day_off' then coalesce(re.amount_override_eur, 150.0) * re.quantity
          else 0
        end
      ) filter (where re.status != 'rejected'),
      0
    ) as extras_total_eur,
    jsonb_build_object(
      'items',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'extra_type', re.extra_type,
            'quantity', re.quantity,
            'unit_eur',
            case
              when re.extra_type = 'travel_half' then coalesce(re.amount_override_eur, 150.0)
              when re.extra_type = 'travel_full' then coalesce(re.amount_override_eur, 300.0)
              when re.extra_type = 'day_off' then coalesce(re.amount_override_eur, 150.0)
              else 0
            end,
            'amount_eur',
            case
              when re.extra_type = 'travel_half' then coalesce(re.amount_override_eur, 150.0) * re.quantity
              when re.extra_type = 'travel_full' then coalesce(re.amount_override_eur, 300.0) * re.quantity
              when re.extra_type = 'day_off' then coalesce(re.amount_override_eur, 150.0) * re.quantity
              else 0
            end
          ) order by re.updated_at
        ) filter (where re.status != 'rejected'),
        '[]'::jsonb
      )
    ) as extras_breakdown,
    -- Vehicle disclaimer logic
    bool_or(
      re.extra_type in ('travel_half', 'travel_full')
      and re.status != 'rejected'
    ) as vehicle_disclaimer,
    'Los importes incluyen gastos de vehículo' as vehicle_disclaimer_text,
    -- Calculated total (without override)
    coalesce(sum(ts.total_eur) filter (where ts.is_active = true), 0) +
    coalesce(
      sum(
        case
          when re.extra_type = 'travel_half' then coalesce(re.amount_override_eur, 150.0) * re.quantity
          when re.extra_type = 'travel_full' then coalesce(re.amount_override_eur, 300.0) * re.quantity
          when re.extra_type = 'day_off' then coalesce(re.amount_override_eur, 150.0) * re.quantity
          else 0
        end
      ) filter (where re.status != 'rejected'),
      0
    ) as calculated_total_eur
  from job_assignments ja
  left join timesheets ts on ts.job_id = ja.job_id and ts.technician_id = ja.technician_id
  left join job_rate_extras re on re.job_id = ja.job_id and re.technician_id = ja.technician_id
  group by ja.job_id, ja.technician_id
) base
left join job_technician_payout_overrides overrides
  on overrides.job_id = base.job_id
  and overrides.technician_id = base.technician_id;

-- Grant appropriate permissions
grant select on v_job_tech_payout_2025 to authenticated;
grant select on v_job_tech_payout_2025 to service_role;
