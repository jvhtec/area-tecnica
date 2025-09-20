-- Fix security issues: Enable RLS on new tables and fix function search paths

-- Enable RLS on new tables
alter table rate_cards_tour_2025 enable row level security;
alter table tour_week_multipliers_2025 enable row level security;

-- Add RLS policies for rate_cards_tour_2025 (management only)
create policy "Management can manage tour rate cards"
on rate_cards_tour_2025
for all
using (get_current_user_role() = any(array['admin'::text, 'management'::text]));

-- Add RLS policies for tour_week_multipliers_2025 (management only)
create policy "Management can manage tour week multipliers"
on tour_week_multipliers_2025
for all
using (get_current_user_role() = any(array['admin'::text, 'management'::text]));

-- Fix function search paths - recreate functions with proper security settings
create or replace function is_house_tech(_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare flag boolean := false;
begin
  select (lower(role) = 'house_tech') into flag 
  from profiles 
  where id = _profile_id;
  return coalesce(flag, false);
end;
$$;

create or replace function iso_year_week_madrid(ts timestamptz)
returns table(iso_year int, iso_week int)
language sql
immutable
security definer
set search_path = public
as $$
  select extract(isoyear from (ts at time zone 'Europe/Madrid'))::int,
         extract(week    from (ts at time zone 'Europe/Madrid'))::int;
$$;

create or replace function compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jtype job_type; st timestamptz; tour_group uuid;
  cat text; house boolean := false;
  base numeric(10,2); mult numeric(6,3) := 1.0; cnt int := 1;
  y int; w int;
begin
  -- Fetch job info
  select job_type, start_time, tour_id
  into jtype, st, tour_group
  from jobs where id = _job_id;

  if not found then return jsonb_build_object('error','job_not_found'); end if;
  if jtype <> 'tourdate' then return jsonb_build_object('error','not_tour_date'); end if;

  -- House tech?
  house := is_house_tech(_tech_id);

  -- Resolve category (for non-house only)
  if not house then
    -- 1) Check if we can map from assignment roles to categories
    select 
      case 
        when sound_role like '%-R' or lights_role like '%-R' or video_role like '%-R' then 'responsable'
        when sound_role like '%-E' or lights_role like '%-E' or video_role like '%-E' then 'especialista' 
        when sound_role like '%-T' or lights_role like '%-T' or video_role like '%-T' then 'tecnico'
        else null
      end into cat
    from job_assignments
    where job_id = _job_id and technician_id = _tech_id;

    -- 2) fallback: profile default
    if cat is null then
      select default_timesheet_category into cat
      from profiles
      where id = _tech_id and default_timesheet_category in ('tecnico','especialista','responsable');
    end if;
    
    if cat is null then
      return jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    end if;
  end if;

  -- Base rate
  if house then
    select base_day_eur into base from house_tech_rates where profile_id = _tech_id;
    if base is null then
      return jsonb_build_object('error','house_rate_missing','profile_id',_tech_id);
    end if;
    mult := 1.0;  -- no multipliers for house techs
  else
    select base_day_eur into base from rate_cards_tour_2025 where category = cat;
    if base is null then
      return jsonb_build_object('error','tour_base_missing','category',cat);
    end if;
  end if;

  -- Multiplier (non-house)
  if not house then
    select iso_year, iso_week into y, w from iso_year_week_madrid(st);

    -- Count tour date jobs for same tech, same tour, same ISO week
    select count(*) into cnt
    from job_assignments a
    join jobs j on j.id = a.job_id
    where a.technician_id = _tech_id
      and j.job_type = 'tourdate'
      and j.tour_id = tour_group
      and (select iso_year from iso_year_week_madrid(j.start_time)) = y
      and (select iso_week from iso_year_week_madrid(j.start_time)) = w;

    select multiplier into mult
    from tour_week_multipliers_2025
    where greatest(1,cnt) between min_dates and max_dates
    order by min_dates
    limit 1;
    if mult is null then mult := 1.0; end if;
  end if;

  return jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'is_house_tech', house,
    'category', cat,
    'base_day_eur', base,
    'week_count', greatest(1,cnt),
    'multiplier', mult,
    'iso_year', y,
    'iso_week', w,
    'total_eur', round(base * mult, 2)
  );
end;
$$;