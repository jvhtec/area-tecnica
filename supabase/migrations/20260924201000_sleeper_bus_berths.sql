-- Sleeper buses (autobús cama) come in different berth layouts, and whether one is
-- big enough depends on how many people are assigned to the job it serves.
--
--  * fleet_vehicles.berth_layouts: the berth counts a bus can be set up with
--    (one value for a fixed layout, several when bunks can be swapped for lounge).
--  * logistics_events.berth_count: berths this run provides, whether it is a fleet
--    bus or one hired from The Wild Tour / Montoya (transport_provider).
--  * get_logistics_matrix() returns both, plus each event's job crew count, so the
--    assignment form can say whether the chosen bus fits.
--
-- Berths only mean something on a sleeper bus: a trigger clears them when a row is
-- switched to another type instead of refusing the edit.
--
-- Also widens hoja_de_ruta_transport.company to every company the Hoja de Ruta form
-- offers. The check still had the original seven, so picking Crespo, Montabi
-- Dorado, Grupo Sesé, Nacex or Recogida cliente failed on save; Montoya is added.

alter table public.fleet_vehicles
  add column if not exists berth_layouts smallint[] not null default '{}'::smallint[];

alter table public.fleet_vehicles
  drop constraint if exists fleet_vehicles_berth_layouts_check;
alter table public.fleet_vehicles
  add constraint fleet_vehicles_berth_layouts_check
  check (
    cardinality(berth_layouts) <= 6
    and 1 <= all (berth_layouts)
    and 40 >= all (berth_layouts)
  );

comment on column public.fleet_vehicles.berth_layouts is
  'Sleeper buses only: berth counts the bus can be set up with (e.g. {12,14,16}). Empty for other vehicles.';

alter table public.logistics_events
  add column if not exists berth_count smallint;

alter table public.logistics_events
  drop constraint if exists logistics_events_berth_count_check;
alter table public.logistics_events
  add constraint logistics_events_berth_count_check
  check (berth_count is null or berth_count between 1 and 80);

comment on column public.logistics_events.berth_count is
  'Sleeper buses only: berths this run provides (fleet bus layout or hired bus size).';

create or replace function public.clear_berths_off_sleeper_bus()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'fleet_vehicles' then
    if new.vehicle_type::text <> 'sleeper_bus' then
      new.berth_layouts := '{}'::smallint[];
    else
      new.berth_layouts := coalesce(
        (select array_agg(distinct b order by b) from unnest(new.berth_layouts) as b where b is not null),
        '{}'::smallint[]
      );
    end if;
  elsif new.transport_type::text <> 'sleeper_bus' then
    new.berth_count := null;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_berths_off_sleeper_bus() from public, anon, authenticated;

drop trigger if exists trg_fleet_vehicles_clear_berths on public.fleet_vehicles;
create trigger trg_fleet_vehicles_clear_berths
  before insert or update of vehicle_type, berth_layouts on public.fleet_vehicles
  for each row execute function public.clear_berths_off_sleeper_bus();

drop trigger if exists trg_logistics_events_clear_berths on public.logistics_events;
create trigger trg_logistics_events_clear_berths
  before insert or update of transport_type, berth_count on public.logistics_events
  for each row execute function public.clear_berths_off_sleeper_bus();

alter table public.hoja_de_ruta_transport
  drop constraint if exists hoja_de_ruta_transport_company_check;
alter table public.hoja_de_ruta_transport
  add constraint hoja_de_ruta_transport_company_check
  check (company = any (array[
    'pantoja', 'transluminaria', 'transcamarena', 'wild tour', 'camionaje', 'sector-pro',
    'crespo', 'montabi_dorado', 'grupo_sese', 'nacex', 'recogida_cliente', 'montoya', 'other'
  ]::text[]));

-- get_logistics_matrix: as in 20260924133000, plus berth_count and job_crew_count
-- on each event. Vehicles already come through to_jsonb(v), so berth_layouts is
-- included without changes.
create or replace function public.get_logistics_matrix(p_start date, p_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_manage boolean;
  v_drivers jsonb;
  v_vehicles jsonb;
  v_events jsonb;
  v_assignments jsonb;
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then
    raise exception 'No tienes permiso para ver la matriz de logística' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Rango de fechas no válido' using errcode = '22023';
  end if;
  if p_end - p_start > 92 then
    raise exception 'El rango máximo es de 93 días' using errcode = '22023';
  end if;

  v_can_manage := public.logistics_matrix_can_manage();

  select coalesce(jsonb_agg(d order by d->>'sort_name', d->>'id'), '[]'::jsonb)
  into v_drivers
  from (
    select jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'nickname', p.nickname,
      'department', p.department,
      -- profiles.phone is private: only those who dispatch (and may need to call
      -- the driver) get it. Read-only viewers receive null.
      'phone', case when v_can_manage then nullif(btrim(p.phone), '') end,
      'sort_name', lower(coalesce(nullif(btrim(p.first_name), ''), p.nickname, '') || ' ' || coalesce(p.last_name, '')),
      'license_categories', coalesce(dd.license_categories, '{}'::text[]),
      'license_expiry', dd.license_expiry,
      'cap_expiry', dd.cap_expiry,
      'tachograph_card_expiry', dd.tachograph_card_expiry,
      'adr_certified', coalesce(dd.adr_certified, false),
      'default_vehicle_id', dd.default_vehicle_id,
      'notes', dd.notes,
      -- Days in range the driver is unavailable: explicit per-day rows win over
      -- an approved vacation request covering the same day.
      'unavailable_days', coalesce((
        select jsonb_agg(u order by u->>'date')
        from (
          select jsonb_build_object('date', ta.date, 'status', ta.status) as u
          from public.technician_availability ta
          where ta.technician_id = p.id::text
            and ta.date between p_start and p_end
            and ta.status in ('vacation', 'travel', 'sick', 'day_off', 'unavailable', 'warehouse')
          union all
          select jsonb_build_object(
            'date', s.date,
            'status', case
              when s.source = 'vacation' then 'vacation'
              when s.source = 'warehouse' then 'warehouse'
              else 'unavailable'
            end
          )
          from public.availability_schedules s
          where s.user_id = p.id
            and s.date between p_start and p_end
            and s.status = 'unavailable'
            and not exists (
              select 1
              from public.technician_availability ta2
              where ta2.technician_id = p.id::text
                and ta2.date = s.date
                and ta2.status in ('vacation', 'travel', 'sick', 'day_off', 'unavailable', 'warehouse')
            )
          union all
          select jsonb_build_object('date', d::date, 'status', 'vacation')
          from public.vacation_requests vr
          cross join lateral generate_series(
            greatest(vr.start_date, p_start)::timestamp,
            least(vr.end_date, p_end)::timestamp,
            interval '1 day'
          ) as d
          where vr.technician_id = p.id
            and vr.status = 'approved'
            and vr.start_date <= p_end
            and vr.end_date >= p_start
            and not exists (
              select 1
              from public.technician_availability ta2
              where ta2.technician_id = p.id::text
                and ta2.date = d::date
                and ta2.status in ('vacation', 'travel', 'sick', 'day_off', 'unavailable', 'warehouse')
            )
            and not exists (
              select 1
              from public.availability_schedules s2
              where s2.user_id = p.id
                and s2.date = d::date
                and s2.status = 'unavailable'
            )
        ) days
      ), '[]'::jsonb)
    ) as d
    from public.profiles p
    left join public.driver_details dd on dd.profile_id = p.id
    where p.role::text = 'conductor'
  ) drivers;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.is_active desc, lower(v.name), v.id), '[]'::jsonb)
  into v_vehicles
  from public.fleet_vehicles v;

  select coalesce(jsonb_agg(e order by e->>'event_date', e->>'event_time', e->>'id'), '[]'::jsonb)
  into v_events
  from (
    select jsonb_build_object(
      'id', le.id,
      'event_type', le.event_type,
      'transport_type', le.transport_type,
      'event_date', le.event_date,
      'event_time', le.event_time,
      'timezone', coalesce(le.timezone, 'Europe/Madrid'),
      'title', le.title,
      'color', coalesce(le.color, j.color),
      'job_id', le.job_id,
      'job_title', j.title,
      'license_plate', le.license_plate,
      'transport_provider', le.transport_provider,
      'berth_count', le.berth_count,
      -- Crew on the job, for sleeper-bus berth planning. Everyone not declined
      -- counts: an invited technician still needs a berth if they accept.
      'job_crew_count', case when le.job_id is null then null else (
        select count(distinct coalesce(ja.technician_id::text, ja.external_technician_name))
        from public.job_assignments ja
        where ja.job_id = le.job_id
          and ja.status is distinct from 'declined'
      ) end,
      'loading_bay', le.loading_bay,
      'notes', le.notes,
      'transport_request_id', le.transport_request_id,
      'origin', tr.origin,
      'destination', tr.destination,
      'location_name', loc.name,
      'location_address', loc.formatted_address,
      'departments', coalesce((
        select jsonb_agg(led.department order by led.department)
        from public.logistics_event_departments led
        where led.event_id = le.id
      ), '[]'::jsonb)
    ) as e
    from public.logistics_events le
    left join public.jobs j on j.id = le.job_id
    left join public.locations loc on loc.id = coalesce(le.location_id, j.location_id)
    left join public.transport_requests tr on tr.id = le.transport_request_id
    where le.event_date between p_start and p_end
       -- A run that overlaps the range from an out-of-range transport date (a Sunday-night
       -- haul in a Monday-first week) still needs its transport to be labelled and editable.
       or le.id in (
         select a.logistics_event_id
         from public.transport_driver_assignments a
         where a.starts_at < (
                 (p_end + 1)::timestamp
                 at time zone coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid')
               )
           and a.ends_at > (
                 p_start::timestamp
                 at time zone coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid')
               )
       )
  ) events;

  -- Assignments are selected by their own window as well as their event date, so a
  -- transport that started the day before the range still blocks the driver's time.
  select coalesce(jsonb_agg(to_jsonb(a) order by a.starts_at, a.id), '[]'::jsonb)
  into v_assignments
  from public.transport_driver_assignments a
  join public.logistics_events le on le.id = a.logistics_event_id
  where le.event_date between p_start and p_end
     or (
       a.starts_at < (
         (p_end + 1)::timestamp
         at time zone coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid')
       )
       and a.ends_at > (
         p_start::timestamp
         at time zone coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid')
       )
     );

  return jsonb_build_object(
    'drivers', v_drivers,
    'vehicles', v_vehicles,
    'events', v_events,
    'assignments', v_assignments
  );
end;
$$;

revoke all on function public.get_logistics_matrix(date, date) from public, anon;
grant execute on function public.get_logistics_matrix(date, date) to authenticated, service_role;
