-- Live driver location for the logistics tracking map.
--
-- A conductor who opts in from /conductor reports their position while a
-- transport is running (or about to). Only the LATEST position per driver is
-- kept — no trail, no history — and a driver can stop sharing at any time,
-- which deletes the row. Logistics (the matrix viewers) see every shared
-- position on the "Seguimiento" tab; a driver only ever sees their own row.
--
-- Writes go exclusively through RPCs so the caller's identity and role, and
-- the ownership of the assignment they attach, are checked server-side.
-- Nothing here touches staffing, timesheets or rates.

create table if not exists public.driver_locations (
  driver_id uuid primary key references public.profiles(id) on delete cascade,
  latitude numeric(10, 8) not null,
  longitude numeric(11, 8) not null,
  accuracy_m numeric(8, 1),
  heading_deg numeric(5, 1),
  speed_mps numeric(6, 2),
  -- The transport the driver is on right now, when the app knows it.
  assignment_id uuid references public.transport_driver_assignments(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_locations_latitude_check check (latitude between -90 and 90),
  constraint driver_locations_longitude_check check (longitude between -180 and 180),
  constraint driver_locations_accuracy_check check (accuracy_m is null or accuracy_m >= 0),
  constraint driver_locations_heading_check check (heading_deg is null or heading_deg between 0 and 360),
  constraint driver_locations_speed_check check (speed_mps is null or speed_mps >= 0)
);

comment on table public.driver_locations is
  'Latest shared position per conductor for the logistics tracking map. Written only through report_driver_location(); stop_sharing_driver_location() deletes the row.';

create index if not exists idx_driver_locations_recorded_at
  on public.driver_locations (recorded_at);

create index if not exists idx_driver_locations_assignment
  on public.driver_locations (assignment_id)
  where assignment_id is not null;

alter table public.driver_locations replica identity full;

drop trigger if exists set_driver_locations_updated_at on public.driver_locations;
create trigger set_driver_locations_updated_at
before update on public.driver_locations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: read for matrix viewers and the driver themselves; no direct writes.
-- ---------------------------------------------------------------------------
alter table public.driver_locations enable row level security;

revoke all on table public.driver_locations from anon;
revoke insert, update, delete, truncate on table public.driver_locations from authenticated;
grant select on table public.driver_locations to authenticated;
grant all on table public.driver_locations to service_role;

drop policy if exists driver_locations_select_scoped on public.driver_locations;
create policy driver_locations_select_scoped
  on public.driver_locations for select to authenticated
  using (
    public.logistics_matrix_can_view()
    or driver_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Driver: report / stop
-- ---------------------------------------------------------------------------
create or replace function public.report_driver_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_heading_deg double precision default null,
  p_speed_mps double precision default null,
  p_assignment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_recorded_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;
  if coalesce(public.get_current_user_role(), '') <> 'conductor' then
    raise exception 'Solo los conductores pueden compartir su ubicación' using errcode = '42501';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'Posición no válida' using errcode = '22023';
  end if;

  -- The attached transport must be the caller's own, live assignment; anything
  -- else is simply not recorded rather than trusted.
  if p_assignment_id is not null and not exists (
    select 1
    from public.transport_driver_assignments a
    where a.id = p_assignment_id
      and a.driver_id = v_uid
      and a.status <> 'declined'
  ) then
    p_assignment_id := null;
  end if;

  insert into public.driver_locations (
    driver_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, assignment_id, recorded_at
  ) values (
    v_uid, p_latitude, p_longitude,
    case when p_accuracy_m is null then null else greatest(p_accuracy_m, 0) end,
    case when p_heading_deg is null or p_heading_deg < 0 then null else p_heading_deg % 360 end,
    case when p_speed_mps is null then null else greatest(p_speed_mps, 0) end,
    p_assignment_id, now()
  )
  on conflict (driver_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m,
        heading_deg = excluded.heading_deg,
        speed_mps = excluded.speed_mps,
        assignment_id = excluded.assignment_id,
        recorded_at = excluded.recorded_at
  returning recorded_at into v_recorded_at;

  -- Opportunistic retention: a position nobody refreshed in a day is gone.
  delete from public.driver_locations
  where recorded_at < now() - interval '24 hours';

  return jsonb_build_object('driver_id', v_uid, 'recorded_at', v_recorded_at);
end;
$$;

revoke all on function public.report_driver_location(double precision, double precision, double precision, double precision, double precision, uuid) from public, anon;
grant execute on function public.report_driver_location(double precision, double precision, double precision, double precision, double precision, uuid) to authenticated, service_role;

create or replace function public.stop_sharing_driver_location()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted integer;
begin
  if v_uid is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  delete from public.driver_locations where driver_id = v_uid;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('driver_id', v_uid, 'stopped', v_deleted > 0);
end;
$$;

revoke all on function public.stop_sharing_driver_location() from public, anon;
grant execute on function public.stop_sharing_driver_location() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Logistics: every shared position, with what the driver is doing right now.
-- ---------------------------------------------------------------------------
create or replace function public.get_driver_locations()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then
    raise exception 'No tienes permiso para ver la ubicación de los conductores' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_data order by row_data->>'recorded_at' desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'driver_id', dl.driver_id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'nickname', p.nickname,
      'latitude', dl.latitude,
      'longitude', dl.longitude,
      'accuracy_m', dl.accuracy_m,
      'heading_deg', dl.heading_deg,
      'speed_mps', dl.speed_mps,
      'recorded_at', dl.recorded_at,
      'assignment', case when a.id is null then null else jsonb_build_object(
        'id', a.id,
        'status', a.status,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'event_type', le.event_type,
        'title', coalesce(nullif(btrim(le.title), ''), j.title),
        'timezone', coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid'),
        'vehicle_name', v.name,
        'vehicle_plate', v.license_plate,
        'destination_name', loc.name,
        'destination_lat', loc.latitude,
        'destination_lng', loc.longitude
      ) end
    ) as row_data
    from public.driver_locations dl
    join public.profiles p on p.id = dl.driver_id
    left join public.transport_driver_assignments a on a.id = dl.assignment_id
    left join public.logistics_events le on le.id = a.logistics_event_id
    left join public.jobs j on j.id = le.job_id
    left join public.locations loc on loc.id = coalesce(le.location_id, j.location_id)
    left join public.fleet_vehicles v on v.id = a.vehicle_id
    -- Anything older than this is no longer "live"; the client also greys out
    -- positions past ten minutes.
    where dl.recorded_at > now() - interval '12 hours'
  ) rows;

  return v_result;
end;
$$;

revoke all on function public.get_driver_locations() from public, anon;
grant execute on function public.get_driver_locations() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime: the tracking map redraws as positions arrive.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'driver_locations'
     ) then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
end;
$$;
