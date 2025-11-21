-- Tour base rates (2025)
create table if not exists rate_cards_tour_2025 (
  category text primary key check (category in ('tecnico','especialista','responsable')),
  base_day_eur numeric(10,2) not null
);

insert into rate_cards_tour_2025(category, base_day_eur) values
  ('tecnico',310.00), ('especialista',360.00), ('responsable',390.00)
on conflict (category) do update set base_day_eur = excluded.base_day_eur;

-- Weekly multipliers
create table if not exists tour_week_multipliers_2025 (
  min_dates int not null,
  max_dates int not null,
  multiplier numeric(6,3) not null,
  primary key (min_dates, max_dates),
  check (min_dates >= 1 and max_dates >= min_dates)
);

insert into tour_week_multipliers_2025(min_dates, max_dates, multiplier) values
  (1,1,1.500), (2,2,1.250), (3,1000,1.000)
on conflict (min_dates, max_dates) do update set multiplier = excluded.multiplier;

-- House tech detection using existing role system
create or replace function is_house_tech(_profile_id uuid)
returns boolean
language plpgsql
as $$
declare flag boolean := false;
begin
  select (lower(role) = 'house_tech') into flag 
  from profiles 
  where id = _profile_id;
  return coalesce(flag, false);
end;
$$;

-- ISO week helper (Europe/Madrid)
create or replace function iso_year_week_madrid(ts timestamptz)
returns table(iso_year int, iso_week int)
language sql immutable as $$
  select extract(isoyear from (ts at time zone 'Europe/Madrid'))::int,
         extract(week    from (ts at time zone 'Europe/Madrid'))::int;
$$;

-- Quote calculation function for tour jobs
create or replace function compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
returns jsonb
language plpgsql
as $$
declare
  jtype text; st timestamptz; tour_group uuid;
  cat text; house boolean := false;
  base numeric(10,2); mult numeric(6,3) := 1.0; cnt int := 1;
  y int; w int;
begin
  -- Fetch job info
  select job_type, start_time, tour_id
  into jtype, st, tour_group
  from jobs where id = _job_id;

  if not found then return jsonb_build_object('error','job_not_found'); end if;
  if lower(jtype) <> 'tourdate' then return jsonb_build_object('error','not_tour_date'); end if;

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
      and lower(j.job_type) = 'tourdate'
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

-- Read view for UI
drop view if exists v_tour_job_rate_quotes_2025;
create or replace view v_tour_job_rate_quotes_2025 as
select
  a.job_id,
  a.technician_id,
  j.start_time,
  j.end_time,
  j.job_type,
  j.tour_id,
  j.title,
  (q->>'is_house_tech')::boolean as is_house_tech,
  (q->>'category') as category,
  (q->>'base_day_eur')::numeric as base_day_eur,
  (q->>'week_count')::int as week_count,
  (q->>'multiplier')::numeric as multiplier,
  (q->>'iso_year')::int as iso_year,
  (q->>'iso_week')::int as iso_week,
  (q->>'total_eur')::numeric as total_eur,
  q as breakdown
from job_assignments a
join jobs j on j.id = a.job_id and lower(j.job_type) = 'tourdate'
cross join lateral compute_tour_job_rate_quote_2025(a.job_id, a.technician_id) q;