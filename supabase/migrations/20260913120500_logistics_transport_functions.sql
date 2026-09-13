-- Logistics transport operations — server-owned commands, guards and read model.
--
-- Final definitions only. This feature was developed across several incremental migrations
-- whose intermediate revisions were superseded before ever running; they are consolidated
-- here so the behaviour of each function is readable in one place.


create or replace function public.transport_request_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_current_user_role() = any (array['admin'::text, 'management'::text]);
$$;

revoke all on function public.transport_request_is_privileged() from public, anon;
grant execute on function public.transport_request_is_privileged() to authenticated, service_role;



create or replace function public.transport_write_actor_is_trusted()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  begin
    v_role := nullif(current_setting('request.jwt.claim.role', true), '');
    if v_role is null then
      v_role := nullif(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        ''
      );
    end if;
  exception when others then
    v_role := null;
  end;

  if v_role = 'service_role' then
    return true;
  end if;

  -- Any other presented role (anon, authenticated) must satisfy the role check.
  if v_role is not null then
    return false;
  end if;

  -- No JWT presented: not a PostgREST request.
  return true;
end;
$$;

revoke all on function public.transport_write_actor_is_trusted() from public, anon;
grant execute on function public.transport_write_actor_is_trusted() to authenticated, service_role;



create or replace function public.transport_stage_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then true
    when p_from in ('completed', 'cancelled') then false
    when p_to = 'cancelled' then true
    -- schedule_transport_request may atomically create a complete plan and confirmation in
    -- one command, so requested/reviewing -> confirmed is a valid action-level shortcut.
    when p_from = 'requested' then p_to in ('reviewing', 'planned', 'confirmed')
    when p_from = 'reviewing' then p_to in ('requested', 'planned', 'confirmed')
    when p_from = 'planned' then p_to in ('reviewing', 'confirmed', 'completed')
    -- Explicitly reopening confirmed demand is legal, but the trigger below removes the old
    -- execution plan in the same transaction so demand and calendar cannot diverge.
    when p_from = 'confirmed' then p_to in ('reviewing', 'planned', 'completed')
    else false
  end;
$$;

revoke all on function public.transport_stage_transition_allowed(text, text) from public, anon;
grant execute on function public.transport_stage_transition_allowed(text, text) to authenticated, service_role;



create or replace function public.tp_is_office_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_current_user_role() = any (array['admin'::text, 'management'::text]);
$$;



create or replace function public.tp_can_edit_department(p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tp_is_office_role();
$$;



create or replace function public.enforce_transport_management_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.transport_write_actor_is_trusted()
     and coalesce(public.get_current_user_role(), '') not in ('admin', 'management') then
    raise exception 'Transport operations require admin or management role'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_transport_management_write() from public, anon, authenticated;
grant execute on function public.enforce_transport_management_write() to service_role;



create or replace function public.normalize_transport_request_source()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subrental_id is not null then
    new.source_type := 'subrental';
    new.source_ref := new.subrental_id::text;
  end if;
  return new;
end;
$$;



create or replace function public.guard_logistics_event_transport_request_link()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_job uuid;
begin
  if new.transport_request_id is null then
    return new;
  end if;

  select job_id into v_request_job
  from public.transport_requests
  where id = new.transport_request_id;

  if v_request_job is null then
    raise exception 'Unknown transport request %', new.transport_request_id using errcode = '23503';
  end if;

  if new.job_id is distinct from v_request_job then
    if tg_op = 'UPDATE' and old.job_id is distinct from new.job_id then
      new.transport_request_id := null;
      return new;
    end if;
    raise exception 'Transport request and logistics event must belong to the same job' using errcode = '23514';
  end if;

  return new;
end;
$$;



create or replace function public.guard_transport_request_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jwt_role text;
  v_has_jwt boolean := false;
  v_expected integer;
  v_load_count integer;
  v_unload_count integer;
  v_confirmed_event_count integer;
begin
  begin
    v_jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
    if v_jwt_role is null then
      v_jwt_role := nullif(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        ''
      );
    end if;
  exception when others then
    v_jwt_role := null;
  end;
  v_has_jwt := v_jwt_role is not null;

  -- Demand is immutable for ordinary authenticated callers once execution exists. Direct DB
  -- maintenance and trusted service-role repair keep the repository's existing bypass model.
  if not public.transport_write_actor_is_trusted()
     and old.planning_status in ('planned', 'confirmed', 'completed', 'cancelled')
     and (
       new.job_id is distinct from old.job_id
       or new.department is distinct from old.department
       or new.description is distinct from old.description
       or new.note is distinct from old.note
       or new.needed_at is distinct from old.needed_at
       or new.origin is distinct from old.origin
       or new.destination is distinct from old.destination
       or new.movement_type is distinct from old.movement_type
       or new.priority is distinct from old.priority
       or new.source_type is distinct from old.source_type
       or new.source_ref is distinct from old.source_ref
       or new.is_hoja_relevant is distinct from old.is_hoja_relevant
     ) then
    raise exception 'Planned, completed or cancelled transport demand cannot be edited; replan or create a new request'
      using errcode = '22023';
  end if;

  -- Legacy status remains a compatibility projection of the planning lifecycle.
  if new.status = 'cancelled' then
    new.planning_status := 'cancelled';
  elsif new.planning_status = 'completed' then
    new.status := 'fulfilled';
  elsif new.planning_status = 'cancelled' then
    new.status := 'cancelled';
  elsif new.status = 'fulfilled' and old.status is distinct from 'fulfilled' then
    new.status := 'requested';
  end if;

  -- Migrations/direct SQL without a request JWT remain able to repair historical rows. Every
  -- API path, including service-role calls, must satisfy the lifecycle invariants below.
  if not v_has_jwt or new.planning_status is not distinct from old.planning_status then
    return new;
  end if;

  if not public.transport_stage_transition_allowed(old.planning_status, new.planning_status) then
    raise exception 'Invalid transport stage transition: % -> %', old.planning_status, new.planning_status
      using errcode = '22023';
  end if;

  select greatest(count(*)::integer, 1)
  into v_expected
  from public.transport_request_items
  where request_id = old.id;

  select
    count(*) filter (where event_type = 'load')::integer,
    count(*) filter (where event_type = 'unload')::integer,
    count(*) filter (
      where nullif(trim(transport_provider::text), '') is not null
         or nullif(trim(license_plate), '') is not null
    )::integer
  into v_load_count, v_unload_count, v_confirmed_event_count
  from public.logistics_events
  where transport_request_id = old.id;

  if new.planning_status in ('planned', 'confirmed', 'completed')
     and (v_load_count <> v_expected or v_unload_count <> v_expected) then
    raise exception 'Transport execution plan is incomplete: expected % load/unload pair(s), found % load and % unload',
      v_expected, v_load_count, v_unload_count
      using errcode = '22023';
  end if;

  if new.planning_status = 'confirmed'
     and v_confirmed_event_count <> (v_expected * 2) then
    raise exception 'Every confirmed transport movement requires a carrier or vehicle identifier'
      using errcode = '22023';
  end if;

  -- Reopening/cancelling demand invalidates execution. Remove it atomically so the calendar
  -- never continues advertising work for a request that no longer has an executable plan.
  if new.planning_status in ('requested', 'reviewing', 'cancelled') then
    delete from public.logistics_event_departments
    where event_id in (
      select id from public.logistics_events where transport_request_id = old.id
    );
    delete from public.logistics_events where transport_request_id = old.id;
  elsif old.planning_status = 'confirmed' and new.planning_status = 'planned' then
    update public.logistics_events
    set transport_provider = null,
        license_plate = null
    where transport_request_id = old.id;
  end if;

  return new;
end;
$$;



create or replace function public.guard_transport_request_item_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_stage text;
begin
  if public.transport_write_actor_is_trusted() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_request_id := case when tg_op = 'DELETE' then old.request_id else new.request_id end;
  select planning_status into v_stage
  from public.transport_requests
  where id = v_request_id;

  if v_stage in ('planned', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Vehicle demand cannot be changed after transport has been planned'
      using errcode = '22023';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_transport_request_item_lifecycle() from public, anon, authenticated;
grant execute on function public.guard_transport_request_item_lifecycle() to service_role;



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



create or replace function public.set_transport_request_stage(p_request_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.transport_requests%rowtype;
  v_has_events boolean;
  v_has_confirmation boolean;
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

  select
    exists (
      select 1 from public.logistics_events le
      where le.transport_request_id = p_request_id
    ),
    exists (
      select 1 from public.logistics_events le
      where le.transport_request_id = p_request_id
        and (
          nullif(trim(le.transport_provider::text), '') is not null
          or nullif(trim(le.license_plate), '') is not null
        )
    )
  into v_has_events, v_has_confirmation;

  if p_stage in ('planned', 'confirmed', 'completed') and not v_has_events then
    raise exception 'Transport must have linked execution events before entering %', p_stage
      using errcode = '22023';
  end if;

  if p_stage = 'confirmed' and not v_has_confirmation then
    raise exception 'Confirmed transport requires a carrier or vehicle identifier'
      using errcode = '22023';
  end if;

  -- Returning a plan to demand/review, or cancelling it, removes the execution plan in the
  -- same transaction. Otherwise the calendar would continue to show work that no longer exists.
  if p_stage in ('requested', 'reviewing', 'cancelled')
     and p_stage is distinct from v_request.planning_status then
    delete from public.logistics_event_departments
    where event_id in (
      select id from public.logistics_events where transport_request_id = p_request_id
    );
    delete from public.logistics_events where transport_request_id = p_request_id;
  elsif v_request.planning_status = 'confirmed' and p_stage = 'planned' then
    update public.logistics_events
    set transport_provider = null,
        license_plate = null
    where transport_request_id = p_request_id;
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
  -- An unload that precedes its own load is always a data-entry error, and the calendar
  -- renders the pair as a single movement, so reject it at the trust boundary too.
  if (p_unload_date + p_unload_time) < (p_load_date + p_load_time) then
    raise exception 'Unload must not be scheduled before the load' using errcode = '22023';
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
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if coalesce(v_role, '') not in ('admin', 'management', 'house_tech') then
    raise exception 'Logistics visibility requires admin, management or house_tech role'
      using errcode = '42501';
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
  ) q;

  return v_result;
end;
$$;

revoke all on function public.list_transport_requests(uuid, text, boolean) from public, anon;
grant execute on function public.list_transport_requests(uuid, text, boolean) to authenticated, service_role;



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
