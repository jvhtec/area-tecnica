-- Crew transfers (traslados de personal) on the logistics calendar and driver matrix.
--
-- The fleet's vans, RVs and sleeper buses also move people, often keeping a vehicle
-- for several days, but a logistics event could only be a load or an unload at one
-- point in time. Builds on the sleeper-bus berth planning of 20260924201000.
--
--  * logistics_events.end_date/end_time: optional end of any transport. A new
--    driver/vehicle assignment defaults to the whole span instead of two hours, and
--    the matrix lists the transport on every day it covers (max. 21 days).
--  * logistics_events.origin_location_id: where the crew is picked up (punto de
--    encuentro). location_id (or the job venue) stays the destination.
--  * logistics_events.passenger_count: how many people travel.
--  * fleet_vehicles.passenger_seats: seats besides the driver, so the assignment form
--    can warn when a van is too small. Sleeper buses keep using berth_layouts.
--
-- Origin and passengers only mean something on a crew transfer: a trigger clears
-- them on loads/unloads instead of refusing the edit, as berths do on non-buses.
-- A return trip is simply a second crew_transfer with origin and destination swapped.
--
--  * logistics_events.movement_type: what a load/unload is for, with the same values
--    as transport_requests.movement_type (traslado, recogida, entrega, devolución,
--    otro). Planning a request used to drop it; a trigger now fills it from the
--    linked request, and the event dialog sets it on manual events. Crew transfers
--    have none.

alter table public.logistics_events
  add column if not exists end_date date,
  add column if not exists end_time time without time zone,
  add column if not exists origin_location_id uuid references public.locations(id) on delete set null,
  add column if not exists passenger_count smallint,
  add column if not exists movement_type text;

alter table public.logistics_events
  drop constraint if exists logistics_events_end_pair_check,
  drop constraint if exists logistics_events_end_after_start_check,
  drop constraint if exists logistics_events_span_check,
  drop constraint if exists logistics_events_passenger_count_check,
  drop constraint if exists logistics_events_movement_type_check,
  drop constraint if exists logistics_events_origin_not_destination_check;

alter table public.logistics_events
  add constraint logistics_events_end_pair_check
    check ((end_date is null) = (end_time is null)),
  add constraint logistics_events_end_after_start_check
    check (end_date is null or end_time is null or (end_date + end_time) > (event_date + event_time)),
  add constraint logistics_events_span_check
    check (end_date is null or end_date - event_date <= 21),
  add constraint logistics_events_passenger_count_check
    check (passenger_count is null or passenger_count between 1 and 80),
  add constraint logistics_events_movement_type_check
    check (movement_type is null or movement_type in ('transfer', 'pickup', 'delivery', 'return', 'other')),
  add constraint logistics_events_origin_not_destination_check
    check (origin_location_id is null or origin_location_id is distinct from location_id);

comment on column public.logistics_events.end_date is
  'Optional local end date of the transport (with end_time). Assignments default to the whole span.';
comment on column public.logistics_events.end_time is
  'Optional local end time of the transport (with end_date).';
comment on column public.logistics_events.origin_location_id is
  'Crew transfers only: pick-up point (punto de encuentro). location_id is the destination.';
comment on column public.logistics_events.passenger_count is
  'Crew transfers only: people travelling.';
comment on column public.logistics_events.movement_type is
  'Loads/unloads: what the move is for (transport_requests.movement_type values). Filled from the linked request when not given.';

create index if not exists idx_logistics_events_origin_location_id
  on public.logistics_events(origin_location_id)
  where origin_location_id is not null;

-- The matrix looks up transports spanning its range by end date.
create index if not exists idx_logistics_events_end_date
  on public.logistics_events(end_date)
  where end_date is not null;

alter table public.fleet_vehicles
  add column if not exists passenger_seats smallint;

alter table public.fleet_vehicles
  drop constraint if exists fleet_vehicles_passenger_seats_check;
alter table public.fleet_vehicles
  add constraint fleet_vehicles_passenger_seats_check
  check (passenger_seats is null or passenger_seats between 1 and 80);

comment on column public.fleet_vehicles.passenger_seats is
  'Seats for passengers besides the driver. Null when unknown or not a people carrier.';

-- The table-level cap was a flat 72 h, which would refuse any multi-day transfer.
-- assign_transport_driver below now enforces the real limit per transport (72 h, or
-- the transport's own span plus a day); the table keeps an absolute backstop at the
-- longest span it allows (21 days) plus that day.
alter table public.transport_driver_assignments
  drop constraint if exists transport_driver_assignments_max_window_check;
alter table public.transport_driver_assignments
  add constraint transport_driver_assignments_max_window_check
  check (ends_at - starts_at <= interval '22 days');

create or replace function public.clear_crew_fields_off_crew_transfer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.event_type::text <> 'crew_transfer' then
    new.origin_location_id := null;
    new.passenger_count := null;
  else
    new.movement_type := null;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_crew_fields_off_crew_transfer() from public, anon, authenticated;

drop trigger if exists trg_logistics_events_clear_crew_fields on public.logistics_events;
create trigger trg_logistics_events_clear_crew_fields
  before insert or update of event_type, origin_location_id, passenger_count, movement_type on public.logistics_events
  for each row execute function public.clear_crew_fields_off_crew_transfer();

-- A load/unload planned from a transport request inherits the request's movement
-- type. schedule_transport_request (re)creates the events, so replanning after the
-- request changes picks up the new type. Runs after the crew-field trigger (names
-- fire alphabetically) and leaves crew transfers alone.
create or replace function public.fill_logistics_event_movement_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.movement_type is null
     and new.transport_request_id is not null
     and new.event_type::text <> 'crew_transfer' then
    select tr.movement_type into new.movement_type
    from public.transport_requests tr
    where tr.id = new.transport_request_id;
  end if;
  return new;
end;
$$;

revoke all on function public.fill_logistics_event_movement_type() from public, anon, authenticated;

drop trigger if exists trg_logistics_events_fill_movement_type on public.logistics_events;
create trigger trg_logistics_events_fill_movement_type
  before insert or update of transport_request_id, movement_type on public.logistics_events
  for each row execute function public.fill_logistics_event_movement_type();

-- Existing planned events get their request's type.
update public.logistics_events le
set movement_type = tr.movement_type
from public.transport_requests tr
where tr.id = le.transport_request_id
  and le.movement_type is null
  and le.event_type::text <> 'crew_transfer';

-- ---------------------------------------------------------------------------
-- Event edits carry their assignments along. As in 20260924133000, plus: the new
-- columns are material (the driver re-confirms), and an assignment whose window
-- ended with the transport keeps ending with it when the end moves. Before this
-- migration "the transport's end" was always start + 2 h, the default window.
-- ---------------------------------------------------------------------------
create or replace function public.sync_driver_assignments_after_logistics_event_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_time_changed boolean;
  v_material_change boolean;
  v_old_tz text := coalesce(nullif(btrim(old.timezone), ''), 'Europe/Madrid');
  v_new_tz text := coalesce(nullif(btrim(new.timezone), ''), 'Europe/Madrid');
  v_old_anchor timestamptz;
  v_new_anchor timestamptz;
  v_old_end timestamptz;
  v_new_end timestamptz;
  v_delta interval := interval '0';
begin
  v_time_changed :=
       old.event_date is distinct from new.event_date
    or old.event_time is distinct from new.event_time
    or old.end_date is distinct from new.end_date
    or old.end_time is distinct from new.end_time
    or old.timezone is distinct from new.timezone;

  v_material_change := v_time_changed
    or old.event_type is distinct from new.event_type
    or old.transport_type is distinct from new.transport_type
    or old.job_id is distinct from new.job_id
    or old.title is distinct from new.title
    or old.loading_bay is distinct from new.loading_bay
    or old.notes is distinct from new.notes
    or old.location_id is distinct from new.location_id
    or old.origin_location_id is distinct from new.origin_location_id
    or old.passenger_count is distinct from new.passenger_count;

  if not v_material_change then
    return new;
  end if;

  if v_time_changed then
    v_old_anchor := (old.event_date + old.event_time) at time zone v_old_tz;
    v_new_anchor := (new.event_date + new.event_time) at time zone v_new_tz;
    v_delta := v_new_anchor - v_old_anchor;
    v_old_end := case
      when old.end_date is not null and old.end_time is not null
        then (old.end_date + old.end_time) at time zone v_old_tz
      else v_old_anchor + interval '2 hours'
    end;
    v_new_end := case
      when new.end_date is not null and new.end_time is not null
        then (new.end_date + new.end_time) at time zone v_new_tz
      else v_new_anchor + interval '2 hours'
    end;

    -- Match assign_transport_driver's resource lock order so a calendar edit
    -- cannot race a matrix save into a silent double booking.
    perform pg_advisory_xact_lock(k)
    from (
      select distinct hashtextextended('transport_driver_assignments:' || r, 0) as k
      from public.transport_driver_assignments a
      cross join lateral unnest(array[
        case when a.driver_id is not null then 'driver:' || a.driver_id::text end,
        case when a.vehicle_id is not null then 'vehicle:' || a.vehicle_id::text end
      ]) as r
      where a.logistics_event_id = new.id
        and a.status <> 'declined'
        and r is not null
      order by 1
    ) keys;

    if exists (
      select 1
      from public.transport_driver_assignments a
      where a.logistics_event_id = new.id
        and a.status <> 'declined'
        and a.ends_at = v_old_end
        and v_new_end <= a.starts_at + v_delta
    ) then
      raise exception
        'El nuevo fin del transporte es anterior al inicio de una asignación. Ajusta primero la matriz.'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.transport_driver_assignments a
      cross join lateral (
        select
          a.starts_at + v_delta as starts_at,
          case when a.ends_at = v_old_end then v_new_end else a.ends_at + v_delta end as ends_at
      ) planned
      join public.transport_driver_assignments other
        on other.id <> a.id
       and other.logistics_event_id <> new.id
       and other.status <> 'declined'
       and tstzrange(other.starts_at, other.ends_at, '[)')
           && tstzrange(planned.starts_at, planned.ends_at, '[)')
       and (
         (a.driver_id is not null and other.driver_id = a.driver_id)
         or (a.vehicle_id is not null and other.vehicle_id = a.vehicle_id)
       )
      where a.logistics_event_id = new.id
        and a.status <> 'declined'
    ) then
      raise exception
        'El nuevo horario solapa otra asignación del conductor o vehículo. Ajusta primero la matriz.'
        using errcode = '23P01';
    end if;
  end if;

  update public.transport_driver_assignments
  set starts_at = case when v_time_changed then starts_at + v_delta else starts_at end,
      ends_at = case
        when not v_time_changed then ends_at
        -- Declined history whose window would collapse just moves with the start.
        when ends_at = v_old_end and v_new_end > starts_at + v_delta then v_new_end
        else ends_at + v_delta
      end,
      status = case when status = 'confirmed' then 'assigned' else status end,
      responded_at = case when status = 'confirmed' then null else responded_at end,
      decline_reason = case when status = 'confirmed' then null else decline_reason end
  where logistics_event_id = new.id;

  return new;
end;
$$;

revoke all on function public.sync_driver_assignments_after_logistics_event_change()
  from public, anon, authenticated;
grant execute on function public.sync_driver_assignments_after_logistics_event_change() to service_role;

drop trigger if exists sync_driver_assignments_after_logistics_event_change on public.logistics_events;
create trigger sync_driver_assignments_after_logistics_event_change
after update of event_type, transport_type, event_date, event_time, end_date, end_time, timezone, job_id,
  title, loading_bay, notes, location_id, origin_location_id, passenger_count
on public.logistics_events
for each row execute function public.sync_driver_assignments_after_logistics_event_change();

-- ---------------------------------------------------------------------------
-- assign_transport_driver: as in 20260924134000, but a transport with an end
-- defaults its assignment window to the whole span, and may last longer than 72 h.
-- ---------------------------------------------------------------------------
create or replace function public.assign_transport_driver(
  p_event_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_notes text default null,
  p_assignment_id uuid default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.logistics_events%rowtype;
  v_existing public.transport_driver_assignments%rowtype;
  v_starts timestamptz;
  v_ends timestamptz;
  v_conflicts jsonb;
  v_availability_conflicts jsonb := '[]'::jsonb;
  v_timezone text;
  v_id uuid;
  v_material_change boolean := true;
  v_previous_driver uuid;
  v_event_end timestamptz;
  v_max_duration interval := interval '72 hours';
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then
    raise exception 'Solo administración o gestión pueden asignar conductores' using errcode = '42501';
  end if;
  if p_driver_id is null and p_vehicle_id is null then
    raise exception 'Indica un conductor o un vehículo' using errcode = '22023';
  end if;

  select * into v_event from public.logistics_events where id = p_event_id;
  if not found then
    raise exception 'Transporte no encontrado' using errcode = 'P0002';
  end if;

  if p_driver_id is not null and not exists (
    select 1 from public.profiles where id = p_driver_id and role::text = 'conductor'
  ) then
    raise exception 'La persona seleccionada no tiene el rol de conductor' using errcode = '22023';
  end if;

  -- Serialize every save that touches this driver or vehicle, so two concurrent saves
  -- cannot both pass the overlap check below before either row is visible. Keys are
  -- taken in a fixed order, and before any row lock, so this matches the event-sync
  -- trigger (advisory keys, then assignment rows) and neither can deadlock the other.
  perform pg_advisory_xact_lock(k)
  from (
    select hashtextextended('transport_driver_assignments:' || r, 0) as k
    from unnest(array[
      case when p_driver_id is not null then 'driver:' || p_driver_id::text end,
      case when p_vehicle_id is not null then 'vehicle:' || p_vehicle_id::text end
    ]) as r
    where r is not null
    order by 1
  ) keys;

  if p_assignment_id is not null then
    select * into v_existing
    from public.transport_driver_assignments
    where id = p_assignment_id
    for update;
    if not found then
      raise exception 'Asignación no encontrada' using errcode = 'P0002';
    end if;
    if v_existing.logistics_event_id <> p_event_id then
      raise exception 'La asignación pertenece a otro transporte' using errcode = '22023';
    end if;
    v_previous_driver := v_existing.driver_id;
  end if;

  -- An inactive vehicle may stay on an assignment it already had, but cannot be newly
  -- assigned.
  if p_vehicle_id is not null
     and p_vehicle_id is distinct from v_existing.vehicle_id
     and not exists (select 1 from public.fleet_vehicles where id = p_vehicle_id and is_active) then
    raise exception 'El vehículo no existe o está inactivo' using errcode = '22023';
  end if;

  v_starts := coalesce(
    p_starts_at,
    (v_event.event_date + v_event.event_time) at time zone coalesce(nullif(v_event.timezone, ''), 'Europe/Madrid')
  );
  -- A transport with its own end (a crew transfer that keeps a van for days) blocks
  -- the driver and vehicle until then; otherwise the window defaults to two hours.
  if v_event.end_date is not null and v_event.end_time is not null then
    v_event_end := (v_event.end_date + v_event.end_time)
      at time zone coalesce(nullif(v_event.timezone, ''), 'Europe/Madrid');
  end if;
  v_ends := coalesce(p_ends_at, v_event_end, v_starts + interval '2 hours');
  if v_ends <= v_starts then
    raise exception 'La hora de fin debe ser posterior a la de inicio' using errcode = '22023';
  end if;
  -- 72 hours still catches a mistyped end, except on a transport planned to last
  -- longer: then the limit is the transport itself plus a day of slack.
  if v_event_end is not null then
    v_max_duration := greatest(v_max_duration, v_event_end - v_starts + interval '24 hours');
  end if;
  if v_ends - v_starts > v_max_duration then
    raise exception 'La asignación dura más de lo previsto para este transporte' using errcode = '22023';
  end if;
  v_timezone := coalesce(nullif(btrim(v_event.timezone), ''), 'Europe/Madrid');

  -- Double-booking: the same driver or vehicle on an overlapping window. Declined rows
  -- no longer hold the slot.
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', a.id,
    'kind', case when p_driver_id is not null and a.driver_id = p_driver_id then 'driver' else 'vehicle' end,
    'logistics_event_id', a.logistics_event_id,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'timezone', coalesce(le.timezone, 'Europe/Madrid'),
    'title', coalesce(nullif(le.title, ''), j.title)
  ) order by a.starts_at), '[]'::jsonb)
  into v_conflicts
  from public.transport_driver_assignments a
  join public.logistics_events le on le.id = a.logistics_event_id
  left join public.jobs j on j.id = le.job_id
  where a.id is distinct from p_assignment_id
    and a.status <> 'declined'
    and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_starts, v_ends, '[)')
    and (
      (p_driver_id is not null and a.driver_id = p_driver_id)
      or (p_vehicle_id is not null and a.vehicle_id = p_vehicle_id)
    );

  -- Employees are assigned directly: there is no staffing availability/offer phase.
  -- Known leave/unavailability is still a scheduling constraint. It joins the same
  -- conflict response as double-booking and can only be bypassed via the explicit
  -- manager "Guardar igualmente" path (p_force).
  if p_driver_id is not null then
    with days as (
      select d::date as day
      from generate_series(
        (v_starts at time zone v_timezone)::date::timestamp,
        ((v_ends - interval '1 microsecond') at time zone v_timezone)::date::timestamp,
        interval '1 day'
      ) d
    ),
    resolved as (
      select d.day, status_row.status
      from days d
      cross join lateral (
        select candidate.status
        from (
          select ta.status::text as status, 1 as priority
          from public.technician_availability ta
          where ta.technician_id = p_driver_id::text
            and ta.date = d.day
            and ta.status in ('vacation', 'travel', 'sick', 'day_off')
          union all
          select case
                   when s.source = 'vacation' then 'vacation'
                   when s.source = 'warehouse' then 'warehouse'
                   else 'unavailable'
                 end as status,
                 2 as priority
          from public.availability_schedules s
          where s.user_id = p_driver_id
            and s.date = d.day
            and s.status = 'unavailable'
          union all
          select 'vacation' as status, 3 as priority
          from public.vacation_requests vr
          where vr.technician_id = p_driver_id
            and vr.status = 'approved'
            and d.day between vr.start_date and vr.end_date
        ) candidate
        order by candidate.priority
        limit 1
      ) status_row
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'assignment_id', 'availability:' || r.day::text,
      'kind', 'availability',
      'logistics_event_id', p_event_id,
      'starts_at', r.day::timestamp at time zone v_timezone,
      'ends_at', (r.day + 1)::timestamp at time zone v_timezone,
      'timezone', v_timezone,
      'title', case r.status
        when 'vacation' then 'Vacaciones'
        when 'travel' then 'Viaje'
        when 'sick' then 'Baja'
        when 'day_off' then 'Día libre'
        when 'warehouse' then 'Almacén'
        else 'No disponible'
      end
    ) order by r.day), '[]'::jsonb)
    into v_availability_conflicts
    from resolved r;

    v_conflicts := coalesce(v_conflicts, '[]'::jsonb) || coalesce(v_availability_conflicts, '[]'::jsonb);
  end if;

  if jsonb_array_length(v_conflicts) > 0 and not coalesce(p_force, false) then
    return jsonb_build_object('status', 'conflict', 'conflicts', v_conflicts);
  end if;

  begin
    if p_assignment_id is null then
      insert into public.transport_driver_assignments(
        logistics_event_id, driver_id, vehicle_id, starts_at, ends_at, notes, assigned_by
      ) values (
        p_event_id, p_driver_id, p_vehicle_id, v_starts, v_ends,
        nullif(btrim(p_notes), ''), auth.uid()
      )
      returning id into v_id;
    else
      v_material_change := v_existing.driver_id is distinct from p_driver_id
        or v_existing.vehicle_id is distinct from p_vehicle_id
        or v_existing.starts_at is distinct from v_starts
        or v_existing.ends_at is distinct from v_ends
        -- Instructions for the driver are part of the plan they confirm.
        or v_existing.notes is distinct from nullif(btrim(p_notes), '');

      update public.transport_driver_assignments
      set driver_id = p_driver_id,
          vehicle_id = p_vehicle_id,
          starts_at = v_starts,
          ends_at = v_ends,
          notes = nullif(btrim(p_notes), ''),
          assigned_by = auth.uid(),
          -- A driver confirms a concrete plan: any change to who, what or when needs a
          -- fresh confirmation, and an old refusal no longer describes this plan.
          status = case when v_material_change then 'assigned' else status end,
          responded_at = case when v_material_change then null else responded_at end,
          decline_reason = case when v_material_change then null else decline_reason end
      where id = p_assignment_id
      returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Ese conductor o vehículo ya está asignado a este transporte' using errcode = '23505';
  end;

  return jsonb_build_object(
    'status', 'saved',
    'assignment_id', v_id,
    'driver_id', p_driver_id,
    'previous_driver_id', v_previous_driver,
    'material_change', v_material_change,
    'conflicts', v_conflicts
  );
end;
$$;


revoke all on function public.assign_transport_driver(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, boolean) from public, anon;
grant execute on function public.assign_transport_driver(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_logistics_matrix: as in 20260924201000, plus the end, passengers and origin of
-- each transport, and transports that span the range without starting in it.
-- ---------------------------------------------------------------------------
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
    with event_scope as materialized (
      select le.*
      from public.logistics_events le
      where le.event_date between p_start and p_end
         -- A multi-day transport is in scope on every day it spans.
         or (le.end_date is not null and le.event_date <= p_end and le.end_date >= p_start)
         -- An assignment may overlap the range even when its event starts outside it.
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
    ),
    crew_counts as (
      select
        ja.job_id,
        count(distinct coalesce(ja.technician_id::text, ja.external_technician_name)) as crew_count
      from public.job_assignments ja
      where ja.status is distinct from 'declined'
        and ja.job_id in (
          select distinct es.job_id
          from event_scope es
          where es.job_id is not null
        )
      group by ja.job_id
    )
    select jsonb_build_object(
      'id', le.id,
      'event_type', le.event_type,
      'transport_type', le.transport_type,
      'event_date', le.event_date,
      'event_time', le.event_time,
      'end_date', le.end_date,
      'end_time', le.end_time,
      'timezone', coalesce(le.timezone, 'Europe/Madrid'),
      'title', le.title,
      'color', coalesce(le.color, j.color),
      'job_id', le.job_id,
      'job_title', j.title,
      'license_plate', le.license_plate,
      'transport_provider', le.transport_provider,
      'berth_count', le.berth_count,
      'passenger_count', le.passenger_count,
      'movement_type', coalesce(le.movement_type, case when le.event_type::text <> 'crew_transfer' then tr.movement_type end),
      -- Crew on the job, for sleeper-bus berth planning. Everyone not declined
      -- counts: an invited technician still needs a berth if they accept. Pre-aggregate
      -- once per job instead of running a correlated count for every logistics event.
      'job_crew_count', case when le.job_id is null then null else coalesce(cc.crew_count, 0) end,
      'loading_bay', le.loading_bay,
      'notes', le.notes,
      'transport_request_id', le.transport_request_id,
      -- A crew transfer names both ends as places; a load/unload takes its route
      -- from the transport request.
      'origin', coalesce(nullif(btrim(tr.origin), ''), origin_loc.name),
      'destination', coalesce(
        nullif(btrim(tr.destination), ''),
        case when le.event_type::text = 'crew_transfer' then loc.name end
      ),
      'origin_location_id', le.origin_location_id,
      'location_name', loc.name,
      'location_address', loc.formatted_address,
      'departments', coalesce((
        select jsonb_agg(led.department order by led.department)
        from public.logistics_event_departments led
        where led.event_id = le.id
      ), '[]'::jsonb)
    ) as e
    from event_scope le
    left join public.jobs j on j.id = le.job_id
    left join crew_counts cc on cc.job_id = le.job_id
    left join public.locations loc on loc.id = coalesce(le.location_id, j.location_id)
    left join public.locations origin_loc on origin_loc.id = le.origin_location_id
    left join public.transport_requests tr on tr.id = le.transport_request_id
  ) events;

  -- Assignments are selected by their own window as well as their event date, so a
  -- transport that started the day before the range still blocks the driver's time.
  select coalesce(jsonb_agg(to_jsonb(a) order by a.starts_at, a.id), '[]'::jsonb)
  into v_assignments
  from public.transport_driver_assignments a
  join public.logistics_events le on le.id = a.logistics_event_id
  where le.event_date between p_start and p_end
     or (le.end_date is not null and le.event_date <= p_end and le.end_date >= p_start)
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

-- ---------------------------------------------------------------------------
-- get_my_transport_assignments: as in 20260924133000, plus the end, passengers and
-- the crew pick-up point, so a driver on a crew transfer can navigate to it.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_transport_assignments(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_from date := coalesce(p_from, (now() at time zone 'Europe/Madrid')::date - 1);
  -- No upper bound by default: a driver notified of a transport months ahead must be
  -- able to see and confirm it.
  v_to date := p_to;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;
  if v_to is not null and (v_to < v_from or v_to - v_from > 366) then
    raise exception 'Rango de fechas no válido' using errcode = '22023';
  end if;

  -- Deliberately narrow: what a driver needs to run the transport, nothing about
  -- rates, other crew or the rest of the job.
  select coalesce(jsonb_agg(row_data order by row_data->>'starts_at', row_data->>'id'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'notes', a.notes,
      'responded_at', a.responded_at,
      'decline_reason', a.decline_reason,
      'event_id', le.id,
      'event_type', le.event_type,
      'transport_type', le.transport_type,
      'event_date', le.event_date,
      'event_time', le.event_time,
      'end_date', le.end_date,
      'end_time', le.end_time,
      'passenger_count', le.passenger_count,
      'movement_type', coalesce(le.movement_type, case when le.event_type::text <> 'crew_transfer' then tr.movement_type end),
      'timezone', coalesce(le.timezone, 'Europe/Madrid'),
      'title', le.title,
      'job_id', le.job_id,
      'job_title', j.title,
      'loading_bay', le.loading_bay,
      'event_notes', le.notes,
      'origin', coalesce(nullif(btrim(tr.origin), ''), origin_loc.formatted_address, origin_loc.name),
      'destination', coalesce(
        nullif(btrim(tr.destination), ''),
        case when le.event_type::text = 'crew_transfer' then coalesce(event_loc.name, job_loc.name) end
      ),
      -- Crew transfers: where the crew is picked up (punto de encuentro).
      'pickup_name', origin_loc.name,
      'pickup_address', origin_loc.formatted_address,
      'pickup_lat', origin_loc.latitude,
      'pickup_lng', origin_loc.longitude,
      -- Explicit event place wins. Otherwise the request's origin is the load
      -- target and its destination is the unload target. Only if neither exists
      -- do we fall back to the job venue.
      'location_name', case
        when event_loc.id is not null then event_loc.name
        when le.event_type = 'load' and nullif(btrim(tr.origin), '') is not null then tr.origin
        when le.event_type = 'unload' and nullif(btrim(tr.destination), '') is not null then tr.destination
        else job_loc.name
      end,
      'location_address', case
        when event_loc.id is not null then event_loc.formatted_address
        when le.event_type = 'load' and nullif(btrim(tr.origin), '') is not null then tr.origin
        when le.event_type = 'unload' and nullif(btrim(tr.destination), '') is not null then tr.destination
        else job_loc.formatted_address
      end,
      'location_lat', case
        when event_loc.id is not null then event_loc.latitude
        when (le.event_type = 'load' and nullif(btrim(tr.origin), '') is not null)
          or (le.event_type = 'unload' and nullif(btrim(tr.destination), '') is not null) then null
        else job_loc.latitude
      end,
      'location_lng', case
        when event_loc.id is not null then event_loc.longitude
        when (le.event_type = 'load' and nullif(btrim(tr.origin), '') is not null)
          or (le.event_type = 'unload' and nullif(btrim(tr.destination), '') is not null) then null
        else job_loc.longitude
      end,
      'vehicle', case when v.id is null then null else jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'license_plate', v.license_plate,
        'vehicle_type', v.vehicle_type,
        'has_tail_lift', v.has_tail_lift
      ) end
    ) as row_data
    from public.transport_driver_assignments a
    join public.logistics_events le on le.id = a.logistics_event_id
    left join public.jobs j on j.id = le.job_id
    -- The transport's own place wins over the job venue.
    left join public.locations event_loc on event_loc.id = le.location_id
    left join public.locations job_loc on job_loc.id = j.location_id
    left join public.locations origin_loc on origin_loc.id = le.origin_location_id
    left join public.transport_requests tr on tr.id = le.transport_request_id
    left join public.fleet_vehicles v on v.id = a.vehicle_id
    where a.driver_id = v_uid
      -- Any window overlapping the range, so a multi-day run stays listed until it ends.
      and (
        v_to is null
        or a.starts_at < (
          (v_to + 1)::timestamp
          at time zone coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid')
        )
      )
      and a.ends_at > (
        v_from::timestamp
        at time zone coalesce(nullif(btrim(le.timezone), ''), 'Europe/Madrid')
      )
  ) rows;

  return v_result;
end;
$$;


revoke all on function public.get_my_transport_assignments(date, date) from public, anon;
grant execute on function public.get_my_transport_assignments(date, date) to authenticated, service_role;
