-- Driver dashboard: navigation and on-site contact.
--
--   * logistics_events.location_id: a transport can name its own place (a
--     supplier's warehouse, a pickup point) through the same `locations` rows
--     jobs use. When absent, the job's venue applies.
--   * get_my_transport_assignments() now carries the venue coordinates (for
--     turn-by-turn deep links and the static map preview), the job id, the
--     vehicle's tail-lift flag and the driver's own decline reason.
--   * get_logistics_matrix() labels events with the event's own place first.
--   * get_job_producer_contacts() also releases a job's producer contact rows
--     to a driver who holds a live (non-declined) transport assignment on one
--     of that job's logistics events — the person they call when they arrive.
--
-- Still deliberately narrow: no rates, crew or other job data reach a driver.

alter table public.logistics_events
  add column if not exists location_id uuid references public.locations(id) on delete set null;

comment on column public.logistics_events.location_id is
  'Where this transport happens when it is not (only) the job venue: supplier, pickup point, own warehouse. Falls back to jobs.location_id.';

create index if not exists idx_logistics_events_location_id
  on public.logistics_events (location_id)
  where location_id is not null;

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
      'location_name', loc.name,
      'location_address', loc.formatted_address,
      'location_lat', loc.latitude,
      'location_lng', loc.longitude,
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
    left join public.locations loc on loc.id = coalesce(le.location_id, j.location_id)
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

-- ---------------------------------------------------------------------------
-- Matrix read model: the event's own place labels the transport.
-- Body otherwise identical to 20260924120000_logistics_matrix_operational_fields.
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

-- ---------------------------------------------------------------------------
-- Producer contacts for drivers with a live transport on the job.
-- Body otherwise identical to 20260915154500_add_job_producer_contact_directory.
-- ---------------------------------------------------------------------------
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
      )
    )
  ORDER BY claim.claimed_at, claim.producer_id;
$function$;

COMMENT ON FUNCTION public.get_job_producer_contacts(uuid[]) IS
  'Producer-claim contact projection (name, phone, email) for operational roles, the producer themselves, technicians assigned to the job, and drivers with a live transport assignment on it. Name-only callers must use get_job_producer_claims().';

REVOKE ALL ON FUNCTION public.get_job_producer_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_producer_contacts(uuid[]) TO authenticated, service_role;
