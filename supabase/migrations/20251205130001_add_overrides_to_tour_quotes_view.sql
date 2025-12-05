-- Update v_tour_job_rate_quotes_2025 view to include override amounts
-- This ensures tour date PDFs and emails reflect the override totals

create or replace view v_tour_job_rate_quotes_2025 as
select
  base.*,
  -- Use override amount if exists, otherwise use calculated totals
  coalesce(overrides.override_amount_eur, base.calculated_total_eur) as total_eur,
  coalesce(overrides.override_amount_eur, base.calculated_total_with_extras_eur) as total_with_extras_eur
from (
  -- Base calculation (existing logic) - this is the complete tour rates logic
  select
    ja.job_id,
    ja.technician_id,
    j.title,
    j.start_time,
    j.end_time,
    j.tour_id,
    j.job_type,
    p.default_timesheet_category as category,
    -- Check if technician is a house tech (from custom_tech_rates)
    case
      when exists (
        select 1 from custom_tech_rates ctr
        where ctr.technician_id = ja.technician_id
          and ctr.tour_id = j.tour_id
      )
      then true
      else false
    end as is_house_tech,
    -- Check if technician is assigned tour-wide
    case
      when exists (
        select 1 from tour_assignments ta
        where ta.technician_id = ja.technician_id
          and ta.tour_id = j.tour_id
          and ta.status = 'accepted'
      )
      then true
      else false
    end as is_tour_team_member,
    -- Get base day rate (from custom_tech_rates or profiles)
    coalesce(
      (select ctr.base_day_eur
       from custom_tech_rates ctr
       where ctr.technician_id = ja.technician_id
         and ctr.tour_id = j.tour_id
       limit 1),
      p.base_day_eur,
      0
    ) as base_day_eur,
    -- Week counting and multipliers
    row_number() over (
      partition by ja.technician_id, j.tour_id
      order by j.start_time
    ) as week_count,
    -- Base multiplier logic
    case
      when exists (
        select 1 from tour_assignments ta
        where ta.technician_id = ja.technician_id
          and ta.tour_id = j.tour_id
          and ta.status = 'accepted'
      )
      then
        case
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 1 then 1.0
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 2 then 1.0
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 3 then 1.25
          else 1.5
        end
      else 1.0
    end as multiplier,
    -- Per-job multiplier from job_date_types
    coalesce(
      (select
        case
          when bool_or(jdt.type = 'off') then 0.0
          when bool_or(jdt.type = 'travel') then 0.5
          else 1.0
        end
       from job_date_types jdt
       where jdt.job_id = j.id
       group by jdt.job_id
      ),
      1.0
    ) as per_job_multiplier,
    -- ISO week/year for grouping
    extract(isoyear from j.start_time::date) as iso_year,
    extract(week from j.start_time::date) as iso_week,
    -- Extras from v_job_tech_payout_2025 (without overrides applied)
    payout.extras_breakdown as extras,
    payout.extras_total_eur,
    payout.vehicle_disclaimer,
    payout.vehicle_disclaimer_text,
    -- Calculated totals (without override)
    (coalesce(
      (select ctr.base_day_eur
       from custom_tech_rates ctr
       where ctr.technician_id = ja.technician_id
         and ctr.tour_id = j.tour_id
       limit 1),
      p.base_day_eur,
      0
    ) *
    case
      when exists (
        select 1 from tour_assignments ta
        where ta.technician_id = ja.technician_id
          and ta.tour_id = j.tour_id
          and ta.status = 'accepted'
      )
      then
        case
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 1 then 1.0
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 2 then 1.0
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 3 then 1.25
          else 1.5
        end
      else 1.0
    end *
    coalesce(
      (select
        case
          when bool_or(jdt.type = 'off') then 0.0
          when bool_or(jdt.type = 'travel') then 0.5
          else 1.0
        end
       from job_date_types jdt
       where jdt.job_id = j.id
       group by jdt.job_id
      ),
      1.0
    )) as calculated_total_eur,
    -- Total with extras (without override)
    ((coalesce(
      (select ctr.base_day_eur
       from custom_tech_rates ctr
       where ctr.technician_id = ja.technician_id
         and ctr.tour_id = j.tour_id
       limit 1),
      p.base_day_eur,
      0
    ) *
    case
      when exists (
        select 1 from tour_assignments ta
        where ta.technician_id = ja.technician_id
          and ta.tour_id = j.tour_id
          and ta.status = 'accepted'
      )
      then
        case
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 1 then 1.0
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 2 then 1.0
          when row_number() over (
            partition by ja.technician_id, j.tour_id
            order by j.start_time
          ) = 3 then 1.25
          else 1.5
        end
      else 1.0
    end *
    coalesce(
      (select
        case
          when bool_or(jdt.type = 'off') then 0.0
          when bool_or(jdt.type = 'travel') then 0.5
          else 1.0
        end
       from job_date_types jdt
       where jdt.job_id = j.id
       group by jdt.job_id
      ),
      1.0
    )) + coalesce(payout.extras_total_eur, 0)) as calculated_total_with_extras_eur,
    -- Breakdown JSON (for debugging/transparency)
    jsonb_build_object(
      'base_day_eur', coalesce(
        (select ctr.base_day_eur
         from custom_tech_rates ctr
         where ctr.technician_id = ja.technician_id
           and ctr.tour_id = j.tour_id
         limit 1),
        p.base_day_eur,
        0
      ),
      'multiplier', case
        when exists (
          select 1 from tour_assignments ta
          where ta.technician_id = ja.technician_id
            and ta.tour_id = j.tour_id
            and ta.status = 'accepted'
        )
        then
          case
            when row_number() over (
              partition by ja.technician_id, j.tour_id
              order by j.start_time
            ) = 1 then 1.0
            when row_number() over (
              partition by ja.technician_id, j.tour_id
              order by j.start_time
            ) = 2 then 1.0
            when row_number() over (
              partition by ja.technician_id, j.tour_id
              order by j.start_time
            ) = 3 then 1.25
            else 1.5
          end
        else 1.0
      end,
      'per_job_multiplier', coalesce(
        (select
          case
            when bool_or(jdt.type = 'off') then 0.0
            when bool_or(jdt.type = 'travel') then 0.5
            else 1.0
          end
         from job_date_types jdt
         where jdt.job_id = j.id
         group by jdt.job_id
        ),
        1.0
      )
    ) as breakdown
  from job_assignments ja
  inner join jobs j on j.id = ja.job_id
  left join profiles p on p.id = ja.technician_id
  left join v_job_tech_payout_2025 payout
    on payout.job_id = ja.job_id
    and payout.technician_id = ja.technician_id
  where j.job_type = 'tourdate'
    and j.tour_id is not null
) base
left join job_technician_payout_overrides overrides
  on overrides.job_id = base.job_id
  and overrides.technician_id = base.technician_id;

-- Grant appropriate permissions
grant select on v_tour_job_rate_quotes_2025 to authenticated;
grant select on v_tour_job_rate_quotes_2025 to service_role;
