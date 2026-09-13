-- Enforce the transport lifecycle at the table boundary as well as through the RPCs.
-- Management clients still have scoped table write policies for compatibility, so a state
-- machine that only lives in set_transport_request_stage() can be bypassed by a direct UPDATE.

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

-- Keep the trigger definition explicit in case an older branch/database still has the earlier
-- lifecycle guard attached under the same name.
drop trigger if exists guard_transport_request_lifecycle on public.transport_requests;
create trigger guard_transport_request_lifecycle
before update on public.transport_requests
for each row execute function public.guard_transport_request_lifecycle();
