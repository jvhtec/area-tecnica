-- Generated transport demand is mutable while it is still demand, but once Logistics has
-- created an execution plan the generator must become idempotent. Re-running Tour Logistics
-- or Truck Planner after planning must never rewrite vehicle demand behind live calendar events.

create or replace function public.replace_transport_request_with_items(
  p_request_id uuid,
  p_job_id uuid,
  p_department text,
  p_note text,
  p_status text,
  p_created_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id uuid;
  v_existing_source text;
  v_stage text;
begin
  if v_actor is null or not public.transport_request_is_privileged() then
    raise exception 'Transport operations require admin or management role' using errcode = '42501';
  end if;
  if p_job_id is null or not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'Unknown job' using errcode = '23503';
  end if;
  if p_department not in ('sound', 'lights', 'video') then
    raise exception 'Invalid department' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 then
    raise exception 'Invalid transport items' using errcode = '22023';
  end if;

  -- Compatibility-only parameters. Ownership and lifecycle come from the authenticated actor
  -- and the request itself, never from client-provided status/creator fields.
  perform p_created_by;
  perform p_status;

  if p_request_id is not null then
    select source_type, planning_status
      into v_existing_source, v_stage
    from public.transport_requests
    where id = p_request_id
      and job_id = p_job_id
      and department = p_department
      and planning_status not in ('completed', 'cancelled')
    for update;

    if v_existing_source = 'tour' then
      v_request_id := p_request_id;
    else
      v_stage := null;
    end if;
  end if;

  if v_request_id is null then
    select id, planning_status
      into v_request_id, v_stage
    from public.transport_requests
    where job_id = p_job_id
      and department = p_department
      and source_type = 'tour'
      and source_ref = p_job_id::text
      and planning_status not in ('completed', 'cancelled')
    limit 1
    for update;
  end if;

  -- Once operations has a plan, a generator retry is acknowledgement, not mutation. Changes
  -- must first return the request to review, which atomically removes the old execution plan.
  if v_request_id is not null and v_stage in ('planned', 'confirmed') then
    return v_request_id;
  end if;

  if v_request_id is null then
    insert into public.transport_requests(
      job_id, department, note, status, created_by,
      source_type, source_ref, planning_status, is_hoja_relevant
    ) values (
      p_job_id, p_department, nullif(trim(p_note), ''), 'requested', v_actor,
      'tour', p_job_id::text, 'requested', true
    ) returning id into v_request_id;
  else
    update public.transport_requests
    set note = nullif(trim(p_note), ''),
        source_type = 'tour',
        source_ref = p_job_id::text,
        status = 'requested',
        updated_at = now()
    where id = v_request_id;
  end if;

  delete from public.transport_request_items where request_id = v_request_id;

  insert into public.transport_request_items(request_id, transport_type, leftover_space_meters)
  select v_request_id, item.transport_type, item.leftover_space_meters
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    transport_type text,
    leftover_space_meters numeric
  )
  where item.transport_type in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta')
    and (item.leftover_space_meters is null or item.leftover_space_meters between 0 and 100);

  return v_request_id;
end;
$$;

revoke all on function public.replace_transport_request_with_items(uuid, uuid, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.replace_transport_request_with_items(uuid, uuid, text, text, text, uuid, jsonb) to authenticated, service_role;

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
  v_request_id uuid;
  v_stage text;
  v_source_ref text := 'department-plan';
begin
  if v_actor is null or not public.transport_request_is_privileged() then
    raise exception 'Transport operations require admin or management role' using errcode = '42501';
  end if;
  if p_job_id is null or not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'Unknown job' using errcode = '23503';
  end if;
  if p_department is null or p_department not in ('sound', 'lights') then
    raise exception 'Invalid department: %', p_department using errcode = '22023';
  end if;
  if p_transport_type is null or p_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta') then
    raise exception 'Invalid transport type: %', p_transport_type using errcode = '22023';
  end if;
  if p_leftover_space_meters is not null and (p_leftover_space_meters < 0 or p_leftover_space_meters > 100) then
    raise exception 'Leftover space must be between 0 and 100 meters' using errcode = '22023';
  end if;

  select id, planning_status
    into v_request_id, v_stage
  from public.transport_requests
  where job_id = p_job_id
    and department = p_department
    and source_type = 'truck_planner'
    and source_ref = v_source_ref
    and planning_status not in ('completed', 'cancelled')
  limit 1
  for update;

  if v_request_id is not null and v_stage in ('planned', 'confirmed') then
    return v_request_id;
  end if;

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
      nullif(trim(p_description), ''),
      nullif(trim(p_note), ''),
      'requested',
      'truck_planner',
      v_source_ref,
      'requested',
      true
    ) returning id into v_request_id;
  else
    update public.transport_requests
    set description = coalesce(nullif(trim(p_description), ''), description),
        note = coalesce(nullif(trim(p_note), ''), note),
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
