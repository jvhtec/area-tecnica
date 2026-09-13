-- Server-owned transport-request commands and logistics inbox read model.

create or replace function public.transport_request_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text]);
$$;

revoke all on function public.transport_request_is_privileged() from public, anon;
grant execute on function public.transport_request_is_privileged() to authenticated, service_role;

create or replace function public.save_transport_request(
  p_request_id uuid,
  p_job_id uuid,
  p_department text,
  p_description text default null,
  p_note text default null,
  p_needed_at timestamptz default null,
  p_origin text default null,
  p_destination text default null,
  p_movement_type text default 'transfer',
  p_priority text default 'normal',
  p_is_hoja_relevant boolean default true,
  p_source_type text default 'manual',
  p_source_ref text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.get_current_user_role();
  v_actor_department text := public.current_user_department();
  v_request public.transport_requests%rowtype;
  v_request_id uuid;
  v_item jsonb;
  v_transport_type text;
  v_leftover numeric;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_job_id is null then
    raise exception 'job_id is required' using errcode = '22023';
  end if;
  if p_department not in ('sound', 'lights', 'video') then
    raise exception 'Invalid department' using errcode = '22023';
  end if;
  if p_movement_type not in ('transfer', 'pickup', 'delivery', 'return', 'other') then
    raise exception 'Invalid movement type' using errcode = '22023';
  end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid priority' using errcode = '22023';
  end if;
  if p_source_type not in ('manual', 'subrental', 'tour', 'truck_planner') then
    raise exception 'Invalid source type' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 then
    raise exception 'Invalid transport items' using errcode = '22023';
  end if;

  if not public.transport_request_is_privileged()
     and not (v_role = 'house_tech' and v_actor_department = p_department) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if p_request_id is null then
    if not public.transport_request_is_privileged() and p_source_type <> 'manual' then
      raise exception 'Only logistics/management may create generated transport requests' using errcode = '42501';
    end if;

    insert into public.transport_requests (
      job_id, department, created_by, description, note, status,
      needed_at, origin, destination, movement_type, priority,
      source_type, source_ref, is_hoja_relevant, planning_status
    ) values (
      p_job_id,
      p_department,
      v_actor,
      nullif(trim(p_description), ''),
      nullif(trim(p_note), ''),
      'requested',
      p_needed_at,
      nullif(trim(p_origin), ''),
      nullif(trim(p_destination), ''),
      p_movement_type,
      p_priority,
      p_source_type,
      nullif(trim(p_source_ref), ''),
      p_is_hoja_relevant,
      'requested'
    ) returning id into v_request_id;
  else
    select * into v_request
    from public.transport_requests
    where id = p_request_id
    for update;

    if not found then
      raise exception 'Transport request not found' using errcode = 'P0002';
    end if;
    if v_request.job_id <> p_job_id or v_request.department <> p_department then
      raise exception 'Request scope mismatch' using errcode = '22023';
    end if;
    if v_request.planning_status in ('completed', 'cancelled') then
      raise exception 'Completed or cancelled requests cannot be edited' using errcode = '22023';
    end if;
    if not public.transport_request_is_privileged()
       and v_request.created_by is distinct from v_actor
       and not (v_role = 'house_tech' and v_actor_department = p_department) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    update public.transport_requests
    set description = nullif(trim(p_description), ''),
        note = nullif(trim(p_note), ''),
        needed_at = p_needed_at,
        origin = nullif(trim(p_origin), ''),
        destination = nullif(trim(p_destination), ''),
        movement_type = p_movement_type,
        priority = p_priority,
        is_hoja_relevant = p_is_hoja_relevant,
        source_type = case when public.transport_request_is_privileged() then p_source_type else source_type end,
        source_ref = case when public.transport_request_is_privileged() then nullif(trim(p_source_ref), '') else source_ref end,
        updated_at = now()
    where id = p_request_id;
    v_request_id := p_request_id;
  end if;

  delete from public.transport_request_items where request_id = v_request_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_transport_type := nullif(trim(v_item->>'transport_type'), '');
    if v_transport_type is null or v_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta') then
      raise exception 'Invalid transport type' using errcode = '22023';
    end if;
    v_leftover := nullif(v_item->>'leftover_space_meters', '')::numeric;
    if v_leftover is not null and v_leftover < 0 then
      raise exception 'Leftover space cannot be negative' using errcode = '22023';
    end if;
    insert into public.transport_request_items(request_id, transport_type, leftover_space_meters)
    values (v_request_id, v_transport_type, v_leftover);
  end loop;

  return v_request_id;
end;
$$;

revoke all on function public.save_transport_request(uuid, uuid, text, text, text, timestamptz, text, text, text, text, boolean, text, text, jsonb) from public, anon;
grant execute on function public.save_transport_request(uuid, uuid, text, text, text, timestamptz, text, text, text, text, boolean, text, text, jsonb) to authenticated, service_role;

create or replace function public.set_transport_request_stage(p_request_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.transport_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_stage not in ('requested', 'reviewing', 'planned', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Invalid planning stage' using errcode = '22023';
  end if;

  select * into v_request
  from public.transport_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Transport request not found' using errcode = 'P0002';
  end if;

  if p_stage in ('reviewing', 'planned', 'confirmed', 'completed')
     and not public.transport_request_is_privileged() then
    raise exception 'Only logistics/management may advance planning' using errcode = '42501';
  end if;
  if p_stage = 'cancelled'
     and not public.transport_request_is_privileged()
     and v_request.created_by is distinct from v_actor
     and not (
       public.get_current_user_role() = 'house_tech'
       and public.current_user_department() = v_request.department
     ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  update public.transport_requests
  set planning_status = p_stage,
      status = case
        when p_stage = 'completed' then 'fulfilled'
        when p_stage = 'cancelled' then 'cancelled'
        else 'requested'
      end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.set_transport_request_stage(uuid, text) from public, anon;
grant execute on function public.set_transport_request_stage(uuid, text) to authenticated, service_role;

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
  v_transport_type text;
  v_load_id uuid;
  v_unload_id uuid;
  v_stage text;
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

  select tri.transport_type::text into v_transport_type
  from public.transport_request_items tri
  where tri.request_id = p_request_id
  order by tri.id::text
  limit 1;
  v_transport_type := coalesce(v_transport_type, 'trailer');

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
    v_transport_type::public.transport_type,
    p_load_date,
    p_load_time,
    nullif(trim(p_loading_bay), ''),
    v_request.job_id,
    nullif(trim(p_license_plate), ''),
    nullif(trim(p_provider), '')::public.transport_provider_enum,
    coalesce(nullif(trim(p_notes), ''), v_request.description),
    v_request.is_hoja_relevant,
    p_request_id
  )
  on conflict (transport_request_id, event_type) where transport_request_id is not null
  do update set
    transport_type = excluded.transport_type,
    event_date = excluded.event_date,
    event_time = excluded.event_time,
    loading_bay = excluded.loading_bay,
    license_plate = excluded.license_plate,
    transport_provider = excluded.transport_provider,
    notes = excluded.notes,
    is_hoja_relevant = excluded.is_hoja_relevant,
    job_id = excluded.job_id
  returning id into v_load_id;

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
    v_transport_type::public.transport_type,
    p_unload_date,
    p_unload_time,
    nullif(trim(p_loading_bay), ''),
    v_request.job_id,
    nullif(trim(p_license_plate), ''),
    nullif(trim(p_provider), '')::public.transport_provider_enum,
    coalesce(nullif(trim(p_notes), ''), v_request.description),
    v_request.is_hoja_relevant,
    p_request_id
  )
  on conflict (transport_request_id, event_type) where transport_request_id is not null
  do update set
    transport_type = excluded.transport_type,
    event_date = excluded.event_date,
    event_time = excluded.event_time,
    loading_bay = excluded.loading_bay,
    license_plate = excluded.license_plate,
    transport_provider = excluded.transport_provider,
    notes = excluded.notes,
    is_hoja_relevant = excluded.is_hoja_relevant,
    job_id = excluded.job_id
  returning id into v_unload_id;

  insert into public.logistics_event_departments(event_id, department)
  values (v_load_id, v_request.department)
  on conflict do nothing;

  insert into public.logistics_event_departments(event_id, department)
  values (v_unload_id, v_request.department)
  on conflict do nothing;

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
    'load_event_id', v_load_id,
    'unload_event_id', v_unload_id,
    'planning_status', v_stage
  );
end;
$$;

revoke all on function public.schedule_transport_request(uuid, date, time, date, time, text, text, text, text) from public, anon;
grant execute on function public.schedule_transport_request(uuid, date, time, date, time, text, text, text, text) to authenticated, service_role;

create or replace function public.list_transport_requests(
  p_job_id uuid default null,
  p_department text default null,
  p_include_closed boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.get_current_user_role();
  v_department text := public.current_user_department();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_job_id is null and not public.transport_request_is_privileged() then
    raise exception 'Global transport inbox is restricted to logistics/management' using errcode = '42501';
  end if;
  if p_job_id is not null
     and p_department is not null
     and not public.transport_request_is_privileged()
     and not (v_role = 'house_tech' and v_department = p_department) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(row_payload order by priority_rank, needed_sort nulls last, created_sort desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      case tr.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end as priority_rank,
      tr.needed_at as needed_sort,
      tr.created_at as created_sort,
      jsonb_build_object(
        'id', tr.id,
        'job_id', tr.job_id,
        'job_title', j.title,
        'department', tr.department,
        'status', tr.status,
        'planning_status', tr.planning_status,
        'description', tr.description,
        'note', tr.note,
        'needed_at', tr.needed_at,
        'origin', tr.origin,
        'destination', tr.destination,
        'movement_type', tr.movement_type,
        'priority', tr.priority,
        'source_type', tr.source_type,
        'source_ref', tr.source_ref,
        'is_hoja_relevant', tr.is_hoja_relevant,
        'created_at', tr.created_at,
        'updated_at', tr.updated_at,
        'created_by', tr.created_by,
        'requester_name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', tri.id,
            'transport_type', tri.transport_type,
            'leftover_space_meters', tri.leftover_space_meters
          ) order by tri.id::text)
          from public.transport_request_items tri
          where tri.request_id = tr.id
        ), '[]'::jsonb),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', le.id,
            'event_type', le.event_type,
            'event_date', le.event_date,
            'event_time', le.event_time,
            'transport_provider', le.transport_provider,
            'license_plate', le.license_plate,
            'loading_bay', le.loading_bay
          ) order by le.event_date, le.event_time)
          from public.logistics_events le
          where le.transport_request_id = tr.id
        ), '[]'::jsonb)
      ) as row_payload
    from public.transport_requests tr
    join public.jobs j on j.id = tr.job_id
    left join public.profiles p on p.id = tr.created_by
    where (p_job_id is null or tr.job_id = p_job_id)
      and (p_department is null or tr.department = p_department)
      and (p_include_closed or tr.planning_status not in ('completed', 'cancelled'))
      and (
        public.transport_request_is_privileged()
        or tr.created_by = v_actor
        or (v_role = 'house_tech' and v_department = tr.department)
      )
  ) q;

  return v_result;
end;
$$;

revoke all on function public.list_transport_requests(uuid, text, boolean) from public, anon;
grant execute on function public.list_transport_requests(uuid, text, boolean) to authenticated, service_role;

-- Truck Planner owns a dedicated generated request instead of rewriting whichever manual
-- request happens to be newest for the department.
create or replace function public.tp_upsert_department_transport_request(
  p_job_id uuid,
  p_department text,
  p_transport_type text,
  p_description text default null,
  p_note text default null,
  p_leftover_space_meters numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.get_current_user_role();
  v_request_id uuid;
  v_source_ref text := 'department-plan';
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_department is null or p_department not in ('sound', 'lights') then
    raise exception 'Invalid department: %', p_department using errcode = '22023';
  end if;
  if p_transport_type is null or p_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta') then
    raise exception 'Invalid transport type: %', p_transport_type using errcode = '22023';
  end if;
  if not (
    public.tp_is_office_role()
    or (v_role = 'house_tech' and public.current_user_department() = p_department)
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select id into v_request_id
  from public.transport_requests
  where job_id = p_job_id
    and department = p_department
    and source_type = 'truck_planner'
    and source_ref = v_source_ref
    and planning_status not in ('completed', 'cancelled')
  limit 1;

  if v_request_id is null then
    insert into public.transport_requests(
      job_id,
      department,
      created_by,
      description,
      note,
      status,
      source_type,
      source_ref,
      planning_status,
      is_hoja_relevant
    ) values (
      p_job_id,
      p_department,
      v_actor,
      p_description,
      p_note,
      'requested',
      'truck_planner',
      v_source_ref,
      'requested',
      true
    ) returning id into v_request_id;
  else
    update public.transport_requests
    set description = coalesce(p_description, description),
        note = coalesce(p_note, note),
        updated_at = now()
    where id = v_request_id;
    delete from public.transport_request_items where request_id = v_request_id;
  end if;

  insert into public.transport_request_items(request_id, transport_type, leftover_space_meters)
  values (v_request_id, p_transport_type, p_leftover_space_meters);

  return v_request_id;
end;
$$;

revoke all on function public.tp_upsert_department_transport_request(uuid, text, text, text, text, numeric) from public, anon;
grant execute on function public.tp_upsert_department_transport_request(uuid, text, text, text, text, numeric) to authenticated, service_role;
