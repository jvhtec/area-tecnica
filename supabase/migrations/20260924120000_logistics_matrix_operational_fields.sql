-- Operational completeness for the logistics driver matrix (PR #953 follow-up):
--
--   * Vehicle compliance: ITV and insurance expiry, plus a tail-lift flag the
--     dispatcher needs when a venue has no loading dock.
--   * Driver compliance: tachograph card expiry (required to drive > 3.5 t).
--   * Decline reasons: a driver who cannot do a transport can say why; the
--     reason travels with the "rechazado" push and shows in the matrix.
--   * Availability: the matrix read model exposes each driver's unavailable days
--     (technician_availability rows and approved vacation requests) so the
--     matrix can grey them out and the assignment form can warn.
--   * Dispatch contact: the matrix read model returns a driver's phone to
--     managers only (admin/management), never to read-only viewers.
--
-- Nothing here creates or touches job_assignments, timesheets, rates or staffing
-- rows. Writes still go exclusively through the RPCs.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.fleet_vehicles
  add column if not exists itv_expiry date,
  add column if not exists insurance_expiry date,
  add column if not exists has_tail_lift boolean not null default false;

comment on column public.fleet_vehicles.itv_expiry is
  'Inspección Técnica de Vehículos expiry. Soft warning in the matrix; a vehicle with expired ITV cannot legally circulate.';
comment on column public.fleet_vehicles.insurance_expiry is
  'Vehicle insurance expiry. Soft warning in the matrix.';
comment on column public.fleet_vehicles.has_tail_lift is
  'Plataforma elevadora. Shown to dispatch and the driver so venues without a dock get the right vehicle.';

alter table public.driver_details
  add column if not exists tachograph_card_expiry date;

comment on column public.driver_details.tachograph_card_expiry is
  'Tarjeta de conductor del tacógrafo digital. Needed for vehicles over 3.5 t; soft warning like the CAP.';

alter table public.transport_driver_assignments
  add column if not exists decline_reason text;

alter table public.transport_driver_assignments
  drop constraint if exists transport_driver_assignments_decline_reason_check;

alter table public.transport_driver_assignments
  add constraint transport_driver_assignments_decline_reason_check
  check (decline_reason is null or length(decline_reason) <= 500);

comment on column public.transport_driver_assignments.decline_reason is
  'Optional free text the driver gave when declining. Cleared when the assignment is confirmed or materially changed.';

-- ---------------------------------------------------------------------------
-- Matrix read model: unavailable days, tachograph expiry, manager-only phone.
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

-- ---------------------------------------------------------------------------
-- assign_transport_driver: a material change also clears a stale decline reason
-- (the row goes back to 'assigned' for a fresh answer).
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
-- respond_transport_assignment: optional reason when declining.
-- The two-argument overload is dropped so PostgREST never sees an ambiguous call.
-- ---------------------------------------------------------------------------
drop function if exists public.respond_transport_assignment(uuid, text);

create or replace function public.respond_transport_assignment(
  p_assignment_id uuid,
  p_response text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.transport_driver_assignments%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;
  if p_response is null or p_response not in ('confirmed', 'declined') then
    raise exception 'Respuesta no válida' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'El motivo no puede superar los 500 caracteres' using errcode = '22023';
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
        responded_at = now(),
        -- The reason only makes sense on a refusal; confirming clears any old one.
        decline_reason = case when p_response = 'declined' then v_reason else null end
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
    'decline_reason', v_row.decline_reason,
    'logistics_event_id', v_row.logistics_event_id
  );
end;
$$;

revoke all on function public.respond_transport_assignment(uuid, text, text) from public, anon;
grant execute on function public.respond_transport_assignment(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime: availability changes redraw the matrix. technician_availability is
-- already published by the base schema; vacation_requests is added here.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach v_table in array array['technician_availability', 'vacation_requests']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
