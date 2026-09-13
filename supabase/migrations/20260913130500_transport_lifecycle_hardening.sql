-- Transport request lifecycle and input hardening.
--
-- set_transport_request_stage accepted any stage for a non-terminal request, so the
-- documented requested -> reviewing -> planned -> confirmed -> completed flow was not
-- actually a state machine: a request could jump straight from `requested` to `completed`
-- without ever being planned, and a `confirmed` request could silently regress to
-- `requested`. save_transport_request also trimmed its free-text fields but never bounded
-- them, and schedule_transport_request accepted an unload that happened before its load.

-- ---------------------------------------------------------------------------
-- 1. Legal transitions only.
-- ---------------------------------------------------------------------------
create or replace function public.transport_stage_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case
    -- Re-asserting the current stage is always a no-op, never a transition.
    when p_from = p_to then true
    -- Terminal stages are final; reopening is an explicit, separate action.
    when p_from in ('completed', 'cancelled') then false
    -- Anything still open may be abandoned.
    when p_to = 'cancelled' then true
    when p_from = 'requested'  then p_to in ('reviewing', 'planned')
    when p_from = 'reviewing'  then p_to in ('requested', 'planned')
    when p_from = 'planned'    then p_to in ('reviewing', 'confirmed', 'completed')
    when p_from = 'confirmed'  then p_to in ('planned', 'completed')
    else false
  end;
$$;

revoke all on function public.transport_stage_transition_allowed(text, text) from public, anon;
grant execute on function public.transport_stage_transition_allowed(text, text) to authenticated, service_role;

create or replace function public.set_transport_request_stage(p_request_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.transport_requests%rowtype;
begin
  if auth.uid() is null or not public.transport_request_is_privileged() then
    raise exception 'Transport operations require admin or management role' using errcode = '42501';
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

  if v_request.planning_status in ('completed', 'cancelled')
     and p_stage is distinct from v_request.planning_status then
    raise exception 'Terminal transport requests cannot be reopened implicitly' using errcode = '22023';
  end if;

  if not public.transport_stage_transition_allowed(v_request.planning_status, p_stage) then
    raise exception 'Invalid transport stage transition: % -> %', v_request.planning_status, p_stage
      using errcode = '22023';
  end if;

  -- Completion means the planned movements actually happened, so there must be some.
  if p_stage = 'completed'
     and not exists (
       select 1 from public.logistics_events le where le.transport_request_id = p_request_id
     ) then
    raise exception 'A transport request cannot be completed before it is planned'
      using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- 2. Bound the free-text inputs.
-- ---------------------------------------------------------------------------
-- The client caps these, but the RPC is the trust boundary and a direct caller is not
-- bound by the form. Limits mirror the zod schema in TransportRequestDialog.
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
    if v_transport_type is null or v_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta') then
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

revoke all on function public.save_transport_request(uuid, uuid, text, text, text, timestamptz, text, text, text, text, boolean, text, text, jsonb) from public, anon;
grant execute on function public.save_transport_request(uuid, uuid, text, text, text, timestamptz, text, text, text, text, boolean, text, text, jsonb) to authenticated, service_role;
