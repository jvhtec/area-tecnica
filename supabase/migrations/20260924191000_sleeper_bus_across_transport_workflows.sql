-- Sleeper buses (autobús cama) across every transport workflow, not only the fleet.
--
-- 20260924190000 added 'sleeper_bus' to public.transport_type (logistics events,
-- fleet vehicles). This migration lets the text columns and the request RPCs that
-- hard-code the cargo list accept it too:
--   * transport_request_items, hoja_de_ruta_transport and
--     truck_planner_transport_mappings CHECK constraints (widened; every existing
--     row still satisfies them);
--   * save_transport_request, replace_transport_request_with_items and
--     tp_upsert_department_transport_request, copied verbatim from
--     20260913120500_logistics_transport_functions.sql with only the type list
--     extended. replace_transport_request_with_items filtered unknown item types
--     out silently, so without this a bus item would simply vanish.
-- create or replace keeps each function's owner and grants, so none are re-issued.
--
-- Also fixes a latent failure: tour ops normalises crew bus travel to 'sleeper_bus'
-- and writes it to hoja_de_ruta_transport, which the old constraint rejected.

alter table public.transport_request_items
  drop constraint if exists transport_request_items_transport_type_check;
alter table public.transport_request_items
  add constraint transport_request_items_transport_type_check
  check (transport_type = any (array['trailer', '9m', '8m', '6m', '4m', 'furgoneta', 'sleeper_bus']::text[]));

alter table public.hoja_de_ruta_transport
  drop constraint if exists hoja_de_ruta_transport_transport_type_check;
alter table public.hoja_de_ruta_transport
  add constraint hoja_de_ruta_transport_transport_type_check
  check (transport_type = any (array['trailer', '9m', '8m', '6m', '4m', 'furgoneta', 'sleeper_bus']::text[]));

alter table public.truck_planner_transport_mappings
  drop constraint if exists truck_planner_transport_mappings_transport_type_check;
alter table public.truck_planner_transport_mappings
  add constraint truck_planner_transport_mappings_transport_type_check
  check (transport_type = any (array['trailer', '9m', '8m', '6m', '4m', 'furgoneta', 'sleeper_bus']::text[]));

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
  v_request public.transport_requests%rowtype;
  v_request_id uuid;
  v_item jsonb;
  v_transport_type text;
  v_leftover numeric;
begin
  if v_actor is null or not public.transport_request_is_privileged() then
    raise exception 'Transport operations require admin or management role' using errcode = '42501';
  end if;
  if p_job_id is null then
    raise exception 'job_id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.jobs j where j.id = p_job_id) then
    raise exception 'Unknown job' using errcode = '23503';
  end if;
  if p_department not in ('sound', 'lights', 'video', 'production', 'administrative', 'logistics') then
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
  if length(coalesce(p_description, '')) > 2000
     or length(coalesce(p_note, '')) > 4000
     or length(coalesce(p_origin, '')) > 300
     or length(coalesce(p_destination, '')) > 300
     or length(coalesce(p_source_ref, '')) > 200 then
    raise exception 'Transport request text exceeds the allowed length' using errcode = '22001';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 then
    raise exception 'Invalid transport items' using errcode = '22023';
  end if;

  if p_request_id is null then
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

    update public.transport_requests
    set description = nullif(trim(p_description), ''),
        note = nullif(trim(p_note), ''),
        needed_at = p_needed_at,
        origin = nullif(trim(p_origin), ''),
        destination = nullif(trim(p_destination), ''),
        movement_type = p_movement_type,
        priority = p_priority,
        is_hoja_relevant = p_is_hoja_relevant,
        source_type = p_source_type,
        source_ref = nullif(trim(p_source_ref), ''),
        updated_at = now()
    where id = p_request_id;
    v_request_id := p_request_id;
  end if;

  delete from public.transport_request_items where request_id = v_request_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid transport item' using errcode = '22023';
    end if;
    v_transport_type := nullif(trim(v_item->>'transport_type'), '');
    if v_transport_type is null or v_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta', 'sleeper_bus') then
      raise exception 'Invalid transport type' using errcode = '22023';
    end if;
    v_leftover := nullif(v_item->>'leftover_space_meters', '')::numeric;
    if v_leftover is not null and (v_leftover < 0 or v_leftover > 100) then
      raise exception 'Leftover space must be between 0 and 100 meters' using errcode = '22023';
    end if;
    insert into public.transport_request_items(request_id, transport_type, leftover_space_meters)
    values (v_request_id, v_transport_type, v_leftover);
  end loop;

  return v_request_id;
end;
$$;

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
  where item.transport_type in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta', 'sleeper_bus')
    and (item.leftover_space_meters is null or item.leftover_space_meters between 0 and 100);

  return v_request_id;
end;
$$;

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
  if p_transport_type is null or p_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta', 'sleeper_bus') then
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

