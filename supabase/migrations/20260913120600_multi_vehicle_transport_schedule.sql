-- A transport request can contain several vehicles. Planning the request must therefore
-- create one load/unload pair per requested vehicle instead of silently using only the first.

create or replace function public.schedule_transport_request(
  p_request_id uuid,
  p_load_date date,
  p_load_time time,
  p_unload_date date,
  p_unload_time time,
  p_provider text default null,
  p_license_plate text default null,
  p_loading_bay text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.transport_requests%rowtype;
  v_item record;
  v_load_id uuid;
  v_unload_id uuid;
  v_stage text;
  v_vehicle_count integer := 0;
  v_event_count integer := 0;
begin
  if auth.uid() is null or not public.transport_request_is_privileged() then
    raise exception 'Only logistics/management may schedule transport' using errcode = '42501';
  end if;
  if p_load_date is null or p_load_time is null or p_unload_date is null or p_unload_time is null then
    raise exception 'Load and unload date/time are required' using errcode = '22023';
  end if;

  select * into v_request
  from public.transport_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Transport request not found' using errcode = 'P0002';
  end if;
  if v_request.planning_status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled request cannot be scheduled' using errcode = '22023';
  end if;

  -- Replanning replaces only events that belong to this request. Calendar-only events and
  -- events for other requests are untouched.
  delete from public.logistics_event_departments
  where event_id in (
    select id from public.logistics_events where transport_request_id = p_request_id
  );
  delete from public.logistics_events where transport_request_id = p_request_id;

  for v_item in
    select tri.transport_type::text as transport_type
    from public.transport_request_items tri
    where tri.request_id = p_request_id
    order by tri.id::text
  loop
    v_vehicle_count := v_vehicle_count + 1;

    insert into public.logistics_events(
      event_type,
      transport_type,
      event_date,
      event_time,
      loading_bay,
      job_id,
      license_plate,
      transport_provider,
      notes,
      is_hoja_relevant,
      transport_request_id
    ) values (
      'load',
      v_item.transport_type::public.transport_type,
      p_load_date,
      p_load_time,
      nullif(trim(p_loading_bay), ''),
      v_request.job_id,
      nullif(trim(p_license_plate), ''),
      nullif(trim(p_provider), '')::public.transport_provider_enum,
      coalesce(nullif(trim(p_notes), ''), v_request.description),
      v_request.is_hoja_relevant,
      p_request_id
    ) returning id into v_load_id;

    insert into public.logistics_events(
      event_type,
      transport_type,
      event_date,
      event_time,
      loading_bay,
      job_id,
      license_plate,
      transport_provider,
      notes,
      is_hoja_relevant,
      transport_request_id
    ) values (
      'unload',
      v_item.transport_type::public.transport_type,
      p_unload_date,
      p_unload_time,
      nullif(trim(p_loading_bay), ''),
      v_request.job_id,
      nullif(trim(p_license_plate), ''),
      nullif(trim(p_provider), '')::public.transport_provider_enum,
      coalesce(nullif(trim(p_notes), ''), v_request.description),
      v_request.is_hoja_relevant,
      p_request_id
    ) returning id into v_unload_id;

    insert into public.logistics_event_departments(event_id, department)
    values (v_load_id, v_request.department)
    on conflict do nothing;

    insert into public.logistics_event_departments(event_id, department)
    values (v_unload_id, v_request.department)
    on conflict do nothing;

    v_event_count := v_event_count + 2;
  end loop;

  -- Legacy/subrental requests may have been created without item rows. Keep them schedulable
  -- instead of forcing operators to repair historical data first.
  if v_vehicle_count = 0 then
    insert into public.logistics_events(
      event_type,
      transport_type,
      event_date,
      event_time,
      loading_bay,
      job_id,
      license_plate,
      transport_provider,
      notes,
      is_hoja_relevant,
      transport_request_id
    ) values (
      'load',
      'trailer'::public.transport_type,
      p_load_date,
      p_load_time,
      nullif(trim(p_loading_bay), ''),
      v_request.job_id,
      nullif(trim(p_license_plate), ''),
      nullif(trim(p_provider), '')::public.transport_provider_enum,
      coalesce(nullif(trim(p_notes), ''), v_request.description),
      v_request.is_hoja_relevant,
      p_request_id
    ) returning id into v_load_id;

    insert into public.logistics_events(
      event_type,
      transport_type,
      event_date,
      event_time,
      loading_bay,
      job_id,
      license_plate,
      transport_provider,
      notes,
      is_hoja_relevant,
      transport_request_id
    ) values (
      'unload',
      'trailer'::public.transport_type,
      p_unload_date,
      p_unload_time,
      nullif(trim(p_loading_bay), ''),
      v_request.job_id,
      nullif(trim(p_license_plate), ''),
      nullif(trim(p_provider), '')::public.transport_provider_enum,
      coalesce(nullif(trim(p_notes), ''), v_request.description),
      v_request.is_hoja_relevant,
      p_request_id
    ) returning id into v_unload_id;

    insert into public.logistics_event_departments(event_id, department)
    values (v_load_id, v_request.department)
    on conflict do nothing;
    insert into public.logistics_event_departments(event_id, department)
    values (v_unload_id, v_request.department)
    on conflict do nothing;

    v_vehicle_count := 1;
    v_event_count := 2;
  end if;

  v_stage := case
    when nullif(trim(p_provider), '') is not null
      or nullif(trim(p_license_plate), '') is not null
      then 'confirmed'
    else 'planned'
  end;

  update public.transport_requests
  set planning_status = v_stage,
      status = 'requested',
      updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'planning_status', v_stage,
    'vehicle_count', v_vehicle_count,
    'event_count', v_event_count
  );
end;
$$;

revoke all on function public.schedule_transport_request(uuid, date, time, date, time, text, text, text, text) from public, anon;
grant execute on function public.schedule_transport_request(uuid, date, time, date, time, text, text, text, text) to authenticated, service_role;
