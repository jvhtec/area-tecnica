-- Keep transport demand and execution in sync once a request enters planning.
--
-- A request is the demand record; logistics_events are its execution plan. Once execution
-- exists, silently editing the demand or cancelling only the request produces two competing
-- truths in the UI. This migration makes those relationships transactional invariants.

-- ---------------------------------------------------------------------------
-- 1. Planned demand is immutable to API callers.
-- ---------------------------------------------------------------------------
create or replace function public.guard_transport_request_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_jwt boolean := nullif(current_setting('request.jwt.claim.role', true), '') is not null
    or nullif(current_setting('request.jwt.claims', true), '') is not null;
begin
  -- Direct database maintenance/migrations have no request JWT. API callers, including
  -- service-role generators, must not rewrite demand behind an existing execution plan.
  if v_has_jwt
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

  if new.status = 'cancelled' then
    new.planning_status := 'cancelled';
  elsif new.planning_status = 'completed' then
    new.status := 'fulfilled';
  elsif new.planning_status = 'cancelled' then
    new.status := 'cancelled';
  elsif new.status = 'fulfilled' and old.status is distinct from 'fulfilled' then
    new.status := 'requested';
  end if;
  return new;
end;
$$;

-- Item rows are part of the demand. Lock them at the same boundary. The no-JWT exception is
-- deliberately limited to direct database maintenance so test teardown and migrations remain
-- possible without weakening API consistency.
create or replace function public.guard_transport_request_item_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_stage text;
  v_has_jwt boolean := nullif(current_setting('request.jwt.claim.role', true), '') is not null
    or nullif(current_setting('request.jwt.claims', true), '') is not null;
begin
  if not v_has_jwt then
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

drop trigger if exists guard_transport_request_item_lifecycle on public.transport_request_items;
create trigger guard_transport_request_item_lifecycle
before insert or update or delete on public.transport_request_items
for each row execute function public.guard_transport_request_item_lifecycle();

-- ---------------------------------------------------------------------------
-- 2. Lifecycle transitions maintain their execution-side invariants.
-- ---------------------------------------------------------------------------
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
    -- A deliberate de-confirm keeps the timings but removes the confirmation markers.
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
