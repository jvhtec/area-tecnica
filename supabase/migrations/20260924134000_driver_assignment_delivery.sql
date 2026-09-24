-- Direct employee-driver assignment delivery + availability hardening.
-- Drivers do NOT enter staffing_requests or the technician availability/offer campaign.
-- Management assigns work directly; known absences remain an explicit scheduling conflict.

-- ---------------------------------------------------------------------------
-- Delivery audit/idempotency: one successful channel send per material assignment version.
-- ---------------------------------------------------------------------------
create table if not exists public.driver_assignment_delivery_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.transport_driver_assignments(id) on delete cascade,
  assignment_updated_at timestamptz not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  notification_kind text not null check (notification_kind in ('assigned', 'updated')),
  recipient text,
  sent_at timestamptz not null default now(),
  unique (assignment_id, assignment_updated_at, channel)
);

alter table public.driver_assignment_delivery_log enable row level security;
revoke all on table public.driver_assignment_delivery_log from anon;
revoke insert, update, delete, truncate on table public.driver_assignment_delivery_log from authenticated;
grant select on table public.driver_assignment_delivery_log to authenticated;
grant all on table public.driver_assignment_delivery_log to service_role;

drop policy if exists driver_assignment_delivery_log_select_management on public.driver_assignment_delivery_log;
create policy driver_assignment_delivery_log_select_management
  on public.driver_assignment_delivery_log for select to authenticated
  using (public.logistics_matrix_can_manage());

create index if not exists idx_driver_assignment_delivery_log_assignment
  on public.driver_assignment_delivery_log (assignment_id, sent_at desc);

-- Reuse the existing WAHA quota ledger rather than inventing a second limiter.
alter table public.whatsapp_send_audit
  drop constraint if exists whatsapp_send_audit_kind_check;
alter table public.whatsapp_send_audit
  add constraint whatsapp_send_audit_kind_check
  check (kind in ('job_message', 'group_creation', 'driver_assignment'));

create or replace function public.attempt_whatsapp_send(
  _actor_id uuid,
  _kind text,
  _units integer,
  _daily_limit integer,
  _job_id uuid default null,
  _recipient_count integer default 0
) returns table(allowed boolean, used_today integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer := 0;
begin
  if _kind not in ('job_message', 'group_creation', 'driver_assignment') then
    raise exception 'invalid whatsapp quota kind: %', _kind;
  end if;

  perform pg_advisory_xact_lock(hashtext(_actor_id::text || ':' || _kind));

  select case
           when _kind in ('job_message', 'driver_assignment')
             then coalesce(sum(a.recipient_count), 0)::integer
           else count(*)::integer
         end
    into v_used
    from public.whatsapp_send_audit a
   where a.actor_id = _actor_id
     and a.kind = _kind
     and a.created_at >= now() - interval '24 hours';

  if v_used + greatest(_units, 0) > _daily_limit then
    return query select false, v_used;
    return;
  end if;

  insert into public.whatsapp_send_audit (actor_id, kind, job_id, recipient_count)
  values (_actor_id, _kind, _job_id, _recipient_count);

  return query select true, v_used;
end;
$$;

revoke all on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer) from public, anon, authenticated;
grant execute on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Direct assignment remains the state machine: assigned -> confirmed/declined.
-- Availability is NOT a request phase; it is a manager-visible overrideable conflict.
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
  v_timezone := coalesce(nullif(btrim(v_event.timezone), ''), 'Europe/Madrid');

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
