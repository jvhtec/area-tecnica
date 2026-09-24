-- Logistics matrix — fleet vehicles, driver details and driver/vehicle assignments.
--
-- The logistics matrix mirrors the crew assignment matrix, but its rows are drivers
-- (profiles with the 'conductor' role) and the work assigned are scheduled transports
-- (public.logistics_events), not jobs. A driver may run several transports on the same
-- day, so an assignment carries its own time window (starts_at/ends_at) instead of
-- occupying a whole date cell.
--
-- Access model:
--   * admin/management (the logistics department works as management) manage the fleet,
--     driver details and assignments;
--   * house_tech read the matrix, matching who can open the /logistics page;
--   * conductors see only their own assignments, the vehicles on them and their own
--     driver details, through RLS and get_my_transport_assignments().
-- Assignment writes go exclusively through the RPCs below so conflict checks, role
-- checks and the response state machine cannot be bypassed from the client.
--
-- Invariants: nothing here creates or touches job_assignments, timesheets, rates or
-- staffing rows. Deleting a logistics event (including a replan through
-- schedule_transport_request) cascades to the driver assignments on it.

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.logistics_matrix_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.get_current_user_role(), '') = any (array['admin', 'management']);
$$;

revoke all on function public.logistics_matrix_can_manage() from public, anon;
grant execute on function public.logistics_matrix_can_manage() to authenticated, service_role;

create or replace function public.logistics_matrix_can_view()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.get_current_user_role(), '') = any (
    array['admin', 'management', 'house_tech']
  );
$$;

revoke all on function public.logistics_matrix_can_view() from public, anon;
grant execute on function public.logistics_matrix_can_view() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_plate text not null,
  vehicle_type public.transport_type not null,
  -- Spanish driving licence category needed to drive the vehicle.
  required_license text not null default 'C',
  brand text,
  model text,
  payload_kg integer,
  cargo_length_m numeric(5, 2),
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_vehicles_name_check check (length(btrim(name)) between 1 and 120),
  constraint fleet_vehicles_license_plate_check check (length(btrim(license_plate)) between 1 and 20),
  constraint fleet_vehicles_required_license_check
    check (required_license = any (array['B', 'C1', 'C1+E', 'C', 'C+E', 'D1', 'D'])),
  constraint fleet_vehicles_payload_check check (payload_kg is null or payload_kg >= 0),
  constraint fleet_vehicles_cargo_length_check check (cargo_length_m is null or cargo_length_m >= 0)
);

comment on table public.fleet_vehicles is
  'Own fleet available to the logistics matrix. Deactivate instead of deleting a vehicle with assignment history.';

-- Plates are compared without spaces or dashes so "1234 ABC" and "1234-abc" collide.
create unique index if not exists uq_fleet_vehicles_license_plate
  on public.fleet_vehicles (upper(regexp_replace(license_plate, '[\s-]', '', 'g')));

create index if not exists idx_fleet_vehicles_created_by
  on public.fleet_vehicles (created_by)
  where created_by is not null;

drop trigger if exists set_fleet_vehicles_updated_at on public.fleet_vehicles;
create trigger set_fleet_vehicles_updated_at
before update on public.fleet_vehicles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Driver details (one row per conductor profile)
-- ---------------------------------------------------------------------------
create table if not exists public.driver_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  license_categories text[] not null default '{}'::text[],
  license_expiry date,
  -- Certificado de Aptitud Profesional, required for professional C/D driving.
  cap_expiry date,
  adr_certified boolean not null default false,
  default_vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_details_license_categories_check
    check (license_categories <@ array['B', 'C1', 'C1+E', 'C', 'C+E', 'D1', 'D']::text[])
);

create index if not exists idx_driver_details_default_vehicle
  on public.driver_details (default_vehicle_id)
  where default_vehicle_id is not null;

create index if not exists idx_driver_details_updated_by
  on public.driver_details (updated_by)
  where updated_by is not null;

drop trigger if exists set_driver_details_updated_at on public.driver_details;
create trigger set_driver_details_updated_at
before update on public.driver_details
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Driver / vehicle assignments to scheduled transports
-- ---------------------------------------------------------------------------
create table if not exists public.transport_driver_assignments (
  id uuid primary key default gen_random_uuid(),
  logistics_event_id uuid not null references public.logistics_events(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.fleet_vehicles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'assigned',
  notes text,
  responded_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_driver_assignments_window_check check (ends_at > starts_at),
  constraint transport_driver_assignments_max_window_check check (ends_at - starts_at <= interval '72 hours'),
  constraint transport_driver_assignments_status_check
    check (status = any (array['assigned', 'confirmed', 'declined'])),
  constraint transport_driver_assignments_target_check
    check (driver_id is not null or vehicle_id is not null)
);

comment on table public.transport_driver_assignments is
  'Driver and/or fleet vehicle assigned to a scheduled transport (logistics_events). Written only through assign_transport_driver / remove_transport_driver_assignment / respond_transport_assignment.';

-- A declined row stays as history but releases its driver and vehicle, so the transport
-- can be re-covered without deleting the refusal.
create unique index if not exists uq_transport_driver_assignments_event_driver
  on public.transport_driver_assignments (logistics_event_id, driver_id)
  where driver_id is not null and status <> 'declined';

create unique index if not exists uq_transport_driver_assignments_event_vehicle
  on public.transport_driver_assignments (logistics_event_id, vehicle_id)
  where vehicle_id is not null and status <> 'declined';

create index if not exists idx_transport_driver_assignments_driver_window
  on public.transport_driver_assignments (driver_id, starts_at)
  where driver_id is not null;

create index if not exists idx_transport_driver_assignments_vehicle_window
  on public.transport_driver_assignments (vehicle_id, starts_at)
  where vehicle_id is not null;

create index if not exists idx_transport_driver_assignments_assigned_by
  on public.transport_driver_assignments (assigned_by)
  where assigned_by is not null;

drop trigger if exists set_transport_driver_assignments_updated_at on public.transport_driver_assignments;
create trigger set_transport_driver_assignments_updated_at
before update on public.transport_driver_assignments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.fleet_vehicles enable row level security;
alter table public.driver_details enable row level security;
alter table public.transport_driver_assignments enable row level security;

revoke all on table public.fleet_vehicles from anon;
revoke all on table public.driver_details from anon;
revoke all on table public.transport_driver_assignments from anon;
grant select, insert, update, delete on table public.fleet_vehicles to authenticated;
grant select, insert, update, delete on table public.driver_details to authenticated;
-- Assignments are read directly (matrix realtime, the driver's own rows) but only ever
-- written through the security-definer RPCs.
revoke insert, update, delete, truncate on table public.transport_driver_assignments from authenticated;
grant select on table public.transport_driver_assignments to authenticated;
grant all on table public.fleet_vehicles to service_role;
grant all on table public.driver_details to service_role;
grant all on table public.transport_driver_assignments to service_role;

drop policy if exists fleet_vehicles_select_scoped on public.fleet_vehicles;
create policy fleet_vehicles_select_scoped
  on public.fleet_vehicles for select to authenticated
  using (
    public.logistics_matrix_can_view()
    or exists (
      select 1
      from public.transport_driver_assignments tda
      where tda.vehicle_id = fleet_vehicles.id
        and tda.driver_id = (select auth.uid())
    )
  );

drop policy if exists fleet_vehicles_insert_management on public.fleet_vehicles;
create policy fleet_vehicles_insert_management
  on public.fleet_vehicles for insert to authenticated
  with check (public.logistics_matrix_can_manage());

drop policy if exists fleet_vehicles_update_management on public.fleet_vehicles;
create policy fleet_vehicles_update_management
  on public.fleet_vehicles for update to authenticated
  using (public.logistics_matrix_can_manage())
  with check (public.logistics_matrix_can_manage());

drop policy if exists fleet_vehicles_delete_management on public.fleet_vehicles;
create policy fleet_vehicles_delete_management
  on public.fleet_vehicles for delete to authenticated
  using (public.logistics_matrix_can_manage());

drop policy if exists driver_details_select_scoped on public.driver_details;
create policy driver_details_select_scoped
  on public.driver_details for select to authenticated
  using (
    public.logistics_matrix_can_view()
    or profile_id = (select auth.uid())
  );

drop policy if exists driver_details_insert_management on public.driver_details;
create policy driver_details_insert_management
  on public.driver_details for insert to authenticated
  with check (public.logistics_matrix_can_manage());

drop policy if exists driver_details_update_management on public.driver_details;
create policy driver_details_update_management
  on public.driver_details for update to authenticated
  using (public.logistics_matrix_can_manage())
  with check (public.logistics_matrix_can_manage());

drop policy if exists driver_details_delete_management on public.driver_details;
create policy driver_details_delete_management
  on public.driver_details for delete to authenticated
  using (public.logistics_matrix_can_manage());

drop policy if exists transport_driver_assignments_select_scoped on public.transport_driver_assignments;
create policy transport_driver_assignments_select_scoped
  on public.transport_driver_assignments for select to authenticated
  using (
    public.logistics_matrix_can_view()
    or driver_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Matrix read model
-- ---------------------------------------------------------------------------
create or replace function public.get_logistics_matrix(p_start date, p_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
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

  select coalesce(jsonb_agg(d order by d->>'sort_name', d->>'id'), '[]'::jsonb)
  into v_drivers
  from (
    select jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'nickname', p.nickname,
      'department', p.department,
      'sort_name', lower(coalesce(nullif(btrim(p.first_name), ''), p.nickname, '') || ' ' || coalesce(p.last_name, '')),
      'license_categories', coalesce(dd.license_categories, '{}'::text[]),
      'license_expiry', dd.license_expiry,
      'cap_expiry', dd.cap_expiry,
      'adr_certified', coalesce(dd.adr_certified, false),
      'default_vehicle_id', dd.default_vehicle_id,
      'notes', dd.notes
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
      'loading_bay', le.loading_bay,
      'notes', le.notes,
      'transport_request_id', le.transport_request_id,
      'origin', tr.origin,
      'destination', tr.destination,
      'location_name', loc.name,
      'departments', coalesce((
        select jsonb_agg(led.department order by led.department)
        from public.logistics_event_departments led
        where led.event_id = le.id
      ), '[]'::jsonb)
    ) as e
    from public.logistics_events le
    left join public.jobs j on j.id = le.job_id
    left join public.locations loc on loc.id = j.location_id
    left join public.transport_requests tr on tr.id = le.transport_request_id
    where le.event_date between p_start and p_end
       -- A run that overlaps the range from an out-of-range transport date (a Sunday-night
       -- haul in a Monday-first week) still needs its transport to be labelled and editable.
       or le.id in (
         select a.logistics_event_id
         from public.transport_driver_assignments a
         where a.starts_at < ((p_end + 1)::timestamp at time zone 'Europe/Madrid')
           and a.ends_at > (p_start::timestamp at time zone 'Europe/Madrid')
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
       a.starts_at < ((p_end + 1)::timestamp at time zone 'Europe/Madrid')
       and a.ends_at > (p_start::timestamp at time zone 'Europe/Madrid')
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
-- Assign / update a driver and vehicle on a scheduled transport
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
  v_id uuid;
  v_material_change boolean := true;
  v_previous_driver uuid;
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
  v_ends := coalesce(p_ends_at, v_starts + interval '2 hours');
  if v_ends <= v_starts then
    raise exception 'La hora de fin debe ser posterior a la de inicio' using errcode = '22023';
  end if;
  if v_ends - v_starts > interval '72 hours' then
    raise exception 'Una asignación no puede superar las 72 horas' using errcode = '22023';
  end if;

  -- Serialize every save that touches this driver or vehicle, so two concurrent saves
  -- cannot both pass the overlap check below before either row is visible. Keys are
  -- taken in a fixed order to avoid deadlocks between saves that share both resources.
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

  -- Double-booking: the same driver or vehicle on an overlapping window. Declined rows
  -- no longer hold the slot.
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', a.id,
    'kind', case when p_driver_id is not null and a.driver_id = p_driver_id then 'driver' else 'vehicle' end,
    'logistics_event_id', a.logistics_event_id,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
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
          -- fresh confirmation.
          status = case when v_material_change then 'assigned' else status end,
          responded_at = case when v_material_change then null else responded_at end
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

create or replace function public.remove_transport_driver_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.transport_driver_assignments%rowtype;
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then
    raise exception 'Solo administración o gestión pueden quitar asignaciones' using errcode = '42501';
  end if;

  delete from public.transport_driver_assignments
  where id = p_assignment_id
  returning * into v_row;

  if not found then
    raise exception 'Asignación no encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'assignment_id', v_row.id,
    'driver_id', v_row.driver_id,
    'logistics_event_id', v_row.logistics_event_id,
    'starts_at', v_row.starts_at
  );
end;
$$;

revoke all on function public.remove_transport_driver_assignment(uuid) from public, anon;
grant execute on function public.remove_transport_driver_assignment(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Driver self-service: minimal read model and confirm/decline
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
      'event_id', le.id,
      'event_type', le.event_type,
      'transport_type', le.transport_type,
      'event_date', le.event_date,
      'event_time', le.event_time,
      'title', le.title,
      'job_title', j.title,
      'loading_bay', le.loading_bay,
      'event_notes', le.notes,
      'origin', tr.origin,
      'destination', tr.destination,
      'location_name', loc.name,
      'location_address', loc.formatted_address,
      'vehicle', case when v.id is null then null else jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'license_plate', v.license_plate,
        'vehicle_type', v.vehicle_type
      ) end
    ) as row_data
    from public.transport_driver_assignments a
    join public.logistics_events le on le.id = a.logistics_event_id
    left join public.jobs j on j.id = le.job_id
    left join public.locations loc on loc.id = j.location_id
    left join public.transport_requests tr on tr.id = le.transport_request_id
    left join public.fleet_vehicles v on v.id = a.vehicle_id
    where a.driver_id = v_uid
      -- Any window overlapping the range, so a multi-day run stays listed until it ends.
      and (v_to is null or a.starts_at < ((v_to + 1)::timestamp at time zone 'Europe/Madrid'))
      and a.ends_at > (v_from::timestamp at time zone 'Europe/Madrid')
  ) rows;

  return v_result;
end;
$$;

revoke all on function public.get_my_transport_assignments(date, date) from public, anon;
grant execute on function public.get_my_transport_assignments(date, date) to authenticated, service_role;

create or replace function public.respond_transport_assignment(p_assignment_id uuid, p_response text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.transport_driver_assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;
  if p_response is null or p_response not in ('confirmed', 'declined') then
    raise exception 'Respuesta no válida' using errcode = '22023';
  end if;

  select * into v_row
  from public.transport_driver_assignments
  where id = p_assignment_id
    and driver_id = auth.uid()
  for update;
  if not found then
    raise exception 'Asignación no encontrada' using errcode = 'P0002';
  end if;

  -- A declined row released its slot; taking it back must not double-book the driver or
  -- the vehicle, which assign_transport_driver would have refused without p_force.
  if v_row.status = 'declined' and p_response = 'confirmed' then
    perform pg_advisory_xact_lock(k)
    from (
      select hashtextextended('transport_driver_assignments:' || r, 0) as k
      from unnest(array[
        'driver:' || v_row.driver_id::text,
        case when v_row.vehicle_id is not null then 'vehicle:' || v_row.vehicle_id::text end
      ]) as r
      where r is not null
      order by 1
    ) keys;

    if exists (
      select 1
      from public.transport_driver_assignments other
      where other.id <> v_row.id
        and other.status <> 'declined'
        and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(v_row.starts_at, v_row.ends_at, '[)')
        and (other.driver_id = v_row.driver_id
             or (v_row.vehicle_id is not null and other.vehicle_id = v_row.vehicle_id))
    ) then
      raise exception 'Ya tienes otro transporte a esa hora; habla con logística' using errcode = '23P01';
    end if;
  end if;

  begin
    update public.transport_driver_assignments
    set status = p_response,
        responded_at = now()
    where id = p_assignment_id
      and driver_id = auth.uid()
    returning * into v_row;
  exception when unique_violation then
    -- Re-accepting after declining, once the slot was already given to someone else.
    raise exception 'Este transporte ya se ha reasignado' using errcode = '23505';
  end;

  if not found then
    raise exception 'Asignación no encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'assignment_id', v_row.id,
    'status', v_row.status,
    'logistics_event_id', v_row.logistics_event_id
  );
end;
$$;

revoke all on function public.respond_transport_assignment(uuid, text) from public, anon;
grant execute on function public.respond_transport_assignment(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A driver's upcoming assignments only make sense while they are a conductor: the
-- matrix lists conductors only and the driver loses /conductor with the role. Block
-- the role change until those transports are reassigned or removed, rather than
-- leave staffed-looking assignments nobody can see.
-- ---------------------------------------------------------------------------
create or replace function public.guard_conductor_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role::text = 'conductor'
     and new.role::text is distinct from 'conductor'
     and exists (
       select 1
       from public.transport_driver_assignments a
       where a.driver_id = old.id
         and a.status <> 'declined'
         and a.ends_at > now()
     ) then
    raise exception 'Este conductor tiene transportes pendientes. Reasígnalos o quítalos en la matriz de logística antes de cambiar su rol.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_conductor_role_change() from public, anon, authenticated;
grant execute on function public.guard_conductor_role_change() to service_role;

drop trigger if exists guard_conductor_role_change on public.profiles;
create trigger guard_conductor_role_change
before update of role on public.profiles
for each row
when (old.role is distinct from new.role)
execute function public.guard_conductor_role_change();

-- ---------------------------------------------------------------------------
-- Realtime: the matrix and the driver dashboard refresh on assignment changes.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'transport_driver_assignments'
     ) then
    alter publication supabase_realtime add table public.transport_driver_assignments;
  end if;
end;
$$;
