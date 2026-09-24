-- Hardening follow-up for PR #953.
-- Server-owned privacy/lifecycle invariants for driver tracking and event edits.

-- ---------------------------------------------------------------------------
-- Transactional logistics-event deletion.
-- ---------------------------------------------------------------------------
create or replace function public.delete_logistics_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.logistics_events%rowtype;
begin
  if auth.uid() is null
     or coalesce(public.get_current_user_role(), '') not in ('admin', 'management') then
    raise exception 'Solo administración o gestión pueden eliminar transportes'
      using errcode = '42501';
  end if;

  select * into v_event
  from public.logistics_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Transporte no encontrado' using errcode = 'P0002';
  end if;

  -- If the event delete is rejected by guard_logistics_event_delete_with_assignments,
  -- this whole function rolls back, including the department delete.
  delete from public.logistics_event_departments where event_id = p_event_id;
  delete from public.logistics_events where id = p_event_id;

  return jsonb_build_object('event_id', p_event_id, 'deleted', true);
end;
$$;

revoke all on function public.delete_logistics_event(uuid) from public, anon;
grant execute on function public.delete_logistics_event(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A driver confirms a concrete operational plan. Material event edits reset a
-- confirmed assignment. Date/time/timezone edits also move its assignment window
-- by the same delta while preserving duration and any intentional lead/lag.
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
  v_old_anchor timestamptz;
  v_new_anchor timestamptz;
  v_delta interval := interval '0';
begin
  v_time_changed :=
       old.event_date is distinct from new.event_date
    or old.event_time is distinct from new.event_time
    or old.timezone is distinct from new.timezone;

  v_material_change := v_time_changed
    or old.event_type is distinct from new.event_type
    or old.transport_type is distinct from new.transport_type
    or old.job_id is distinct from new.job_id
    or old.title is distinct from new.title
    or old.loading_bay is distinct from new.loading_bay
    or old.notes is distinct from new.notes
    or old.location_id is distinct from new.location_id;

  if not v_material_change then
    return new;
  end if;

  if v_time_changed then
    v_old_anchor := (old.event_date + old.event_time)
      at time zone coalesce(nullif(btrim(old.timezone), ''), 'Europe/Madrid');
    v_new_anchor := (new.event_date + new.event_time)
      at time zone coalesce(nullif(btrim(new.timezone), ''), 'Europe/Madrid');
    v_delta := v_new_anchor - v_old_anchor;

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
      join public.transport_driver_assignments other
        on other.id <> a.id
       and other.logistics_event_id <> new.id
       and other.status <> 'declined'
       and tstzrange(other.starts_at, other.ends_at, '[)')
           && tstzrange(a.starts_at + v_delta, a.ends_at + v_delta, '[)')
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
      ends_at = case when v_time_changed then ends_at + v_delta else ends_at end,
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
after update of event_type, transport_type, event_date, event_time, timezone, job_id, title, loading_bay, notes, location_id
on public.logistics_events
for each row execute function public.sync_driver_assignments_after_logistics_event_change();

-- ---------------------------------------------------------------------------
-- Driver live location: an assignment is mandatory and the server owns the
-- two-hour lead/end-time boundary. Invalid/out-of-window reports are refused.
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
  if p_assignment_id is null or not exists (
    select 1
    from public.transport_driver_assignments a
    where a.id = p_assignment_id
      and a.driver_id = v_uid
      and a.status <> 'declined'
      and now() >= a.starts_at - interval '2 hours'
      and now() < a.ends_at
  ) then
    raise exception 'No tienes un transporte activo que permita compartir ubicación'
      using errcode = '22023';
  end if;

  insert into public.driver_locations (
    driver_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, assignment_id, recorded_at
  ) values (
    v_uid, p_latitude, p_longitude,
    case when p_accuracy_m is null then null else greatest(p_accuracy_m, 0) end,
    case when p_heading_deg is null or p_heading_deg < 0 then null else mod(p_heading_deg::numeric, 360) end,
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

  return jsonb_build_object('driver_id', v_uid, 'recorded_at', v_recorded_at);
end;
$$;

revoke all on function public.report_driver_location(double precision, double precision, double precision, double precision, double precision, uuid) from public, anon;
grant execute on function public.report_driver_location(double precision, double precision, double precision, double precision, double precision, uuid) to authenticated, service_role;

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
      'assignment', jsonb_build_object(
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
      )
    ) as row_data
    from public.driver_locations dl
    join public.profiles p on p.id = dl.driver_id
    join public.transport_driver_assignments a
      on a.id = dl.assignment_id
     and a.driver_id = dl.driver_id
     and a.status <> 'declined'
     and now() >= a.starts_at - interval '2 hours'
     and now() < a.ends_at
    join public.logistics_events le on le.id = a.logistics_event_id
    left join public.jobs j on j.id = le.job_id
    left join public.locations loc on loc.id = coalesce(le.location_id, j.location_id)
    left join public.fleet_vehicles v on v.id = a.vehicle_id
    where dl.recorded_at > now() - interval '12 hours'
  ) rows;

  return v_result;
end;
$$;

revoke all on function public.get_driver_locations() from public, anon;
grant execute on function public.get_driver_locations() to authenticated, service_role;

-- Remove position rows immediately when their attached assignment stops being
-- eligible. The read RPC already hides them, this prevents needless retention.
create or replace function public.cleanup_driver_location_for_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.driver_locations where assignment_id = old.id;
    return old;
  end if;

  if new.driver_id is distinct from old.driver_id
     or new.status = 'declined'
     or now() < new.starts_at - interval '2 hours'
     or now() >= new.ends_at then
    delete from public.driver_locations where assignment_id = old.id;
  end if;

  return new;
end;
$$;

revoke all on function public.cleanup_driver_location_for_assignment()
  from public, anon, authenticated;
grant execute on function public.cleanup_driver_location_for_assignment() to service_role;

drop trigger if exists cleanup_driver_location_for_assignment on public.transport_driver_assignments;
create trigger cleanup_driver_location_for_assignment
before update of driver_id, status, starts_at, ends_at or delete
on public.transport_driver_assignments
for each row execute function public.cleanup_driver_location_for_assignment();

create or replace function public.cleanup_driver_locations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.driver_locations dl
  where dl.recorded_at < now() - interval '24 hours'
     or not exists (
       select 1
       from public.transport_driver_assignments a
       where a.id = dl.assignment_id
         and a.driver_id = dl.driver_id
         and a.status <> 'declined'
         and now() >= a.starts_at - interval '2 hours'
         and now() < a.ends_at
     );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_driver_locations() from public, anon, authenticated;
grant execute on function public.cleanup_driver_locations() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (
       select 1 from cron.job where jobname = 'cleanup-driver-locations'
     ) then
    perform cron.schedule(
      'cleanup-driver-locations',
      '17 * * * *',
      'select public.cleanup_driver_locations();'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver dashboard/navigation/contact projections.
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
      'timezone', coalesce(le.timezone, 'Europe/Madrid'),
      'title', le.title,
      'job_id', le.job_id,
      'job_title', j.title,
      'loading_bay', le.loading_bay,
      'event_notes', le.notes,
      'origin', tr.origin,
      'destination', tr.destination,
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

CREATE OR REPLACE FUNCTION public.get_job_producer_contacts(
  p_job_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  job_id uuid,
  producer_id uuid,
  display_name text,
  phone text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    claim.job_id,
    claim.producer_id,
    coalesce(
      nullif(trim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      nullif(trim(profile.nickname), ''),
      'Producción'
    ) AS display_name,
    nullif(trim(profile.phone), '') AS phone,
    nullif(trim(profile.email), '') AS email
  FROM public.job_producer_claims AS claim
  JOIN public.profiles AS profile ON profile.id = claim.producer_id
  WHERE auth.uid() IS NOT NULL
    AND (p_job_ids IS NULL OR claim.job_id = ANY (p_job_ids))
    AND (
      (SELECT public.current_user_role()) IN ('admin', 'management', 'logistics')
      OR claim.producer_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.job_assignments AS assignment
        WHERE assignment.job_id = claim.job_id
          AND assignment.technician_id = (SELECT auth.uid())
      )
      -- A driver carrying one of the job's transports needs the producer on site.
      OR EXISTS (
        SELECT 1
        FROM public.transport_driver_assignments AS tda
        JOIN public.logistics_events AS le ON le.id = tda.logistics_event_id
        WHERE le.job_id = claim.job_id
          AND tda.driver_id = (SELECT auth.uid())
          AND tda.status <> 'declined'
          AND tda.ends_at > now()
      )
    )
  ORDER BY claim.claimed_at, claim.producer_id;
$function$;

revoke all on function public.get_job_producer_contacts(uuid[]) from public, anon;
grant execute on function public.get_job_producer_contacts(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Matrix availability now uses the canonical statuses from both availability
-- stores. Approved vacations are only a fallback when no explicit day exists.
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
