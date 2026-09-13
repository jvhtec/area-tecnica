-- Freeze the active pre-merge backlog. PR #938 merged at 2026-09-13T19:20:26Z;
-- its backfill did not record provenance, so this deliberately means pre-merge requests,
-- not an inferred source_type. Later changes to created_at cannot grant eligibility.
create table public.transport_request_legacy_candidates (
  request_id uuid primary key references public.transport_requests(id) on delete cascade,
  captured_at timestamptz not null default statement_timestamp()
);

-- Keep the audit even if the request or its job is subsequently deleted. Eligibility has
-- a separate cascading FK so deleting/recreating an ID cannot reuse its legacy status.
create table public.transport_request_legacy_completions (
  request_id uuid primary key,
  completed_by uuid not null,
  completed_at timestamptz not null,
  reason text not null check (length(reason) between 1 and 1000 and reason ~ '[^[:space:]]'),
  completion_xid xid8 not null
);

alter table public.transport_request_legacy_candidates enable row level security;
alter table public.transport_request_legacy_completions enable row level security;
revoke all on table public.transport_request_legacy_candidates from public, anon, authenticated, service_role;
revoke all on table public.transport_request_legacy_completions from public, anon, authenticated, service_role;
grant select on table public.transport_request_legacy_candidates to authenticated, service_role;
grant select on table public.transport_request_legacy_completions to authenticated, service_role;

create policy "Admins may read legacy transport candidates"
on public.transport_request_legacy_candidates for select to authenticated
using ((select public.get_current_user_role()) = 'admin');
create policy "Admins may read legacy transport completion audit"
on public.transport_request_legacy_completions for select to authenticated
using ((select public.get_current_user_role()) = 'admin');

insert into public.transport_request_legacy_candidates (request_id)
select id from public.transport_requests
where created_at < timestamptz '2026-09-13 19:20:26+00'
  and planning_status in ('requested', 'reviewing', 'planned', 'confirmed')
  and status = 'requested';

create or replace function public.complete_legacy_transport_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.transport_requests%rowtype;
  v_reason text := regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if v_actor is null or coalesce(public.get_current_user_role(), '') <> 'admin' then
    raise exception 'Legacy transport completion requires admin role' using errcode = '42501';
  end if;
  if v_reason is null or length(v_reason) not between 1 and 1000 then
    raise exception 'A legacy completion reason of 1 to 1000 characters is required' using errcode = '22023';
  end if;

  select * into v_request from public.transport_requests
  where id = p_request_id for update;
  if not found then
    raise exception 'Transport request not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.transport_request_legacy_candidates where request_id = p_request_id) then
    raise exception 'Transport request is not eligible for legacy completion' using errcode = '22023';
  end if;

  -- Retries preserve the original actor, timestamp and reason.
  if v_request.planning_status = 'completed' and exists (
    select 1 from public.transport_request_legacy_completions where request_id = p_request_id
  ) then
    return;
  end if;
  if v_request.planning_status not in ('requested', 'reviewing', 'planned', 'confirmed')
     or v_request.status <> 'requested' then
    raise exception 'Only active legacy transport requests can be completed' using errcode = '22023';
  end if;

  insert into public.transport_request_legacy_completions
    (request_id, completed_by, completed_at, reason, completion_xid)
  values (p_request_id, v_actor, clock_timestamp(), v_reason, pg_current_xact_id());

  -- The guard recognizes only this protected audit written by this admin in this transaction.
  -- Existing execution events and vehicle demand are deliberately untouched.
  update public.transport_requests
  set planning_status = 'completed', status = 'fulfilled', updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.complete_legacy_transport_request(uuid, text) from public, anon;
grant execute on function public.complete_legacy_transport_request(uuid, text) to authenticated, service_role;

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
  v_legacy_completion boolean := false;
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

  -- No client-controlled setting grants this exception. It requires a frozen candidate and
  -- an audit inserted by the admin RPC in this same transaction; terminal and demand guards
  -- above remain in force, and the exception authorizes only active -> completed.
  v_legacy_completion := new.planning_status = 'completed'
    and old.planning_status in ('requested', 'reviewing', 'planned', 'confirmed')
    and old.status = 'requested'
    and auth.uid() is not null
    and coalesce(public.get_current_user_role(), '') = 'admin'
    and exists (
      select 1
      from public.transport_request_legacy_candidates candidate
      join public.transport_request_legacy_completions audit using (request_id)
      where candidate.request_id = old.id
        and audit.completed_by = auth.uid()
        and audit.completion_xid = pg_current_xact_id()
    );

  if not v_legacy_completion
     and not public.transport_stage_transition_allowed(old.planning_status, new.planning_status) then
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

  if not v_legacy_completion
     and new.planning_status in ('planned', 'confirmed', 'completed')
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
        'legacy_completion_eligible', tr.planning_status in ('requested', 'reviewing', 'planned', 'confirmed')
          and tr.status = 'requested'
          and exists (select 1 from public.transport_request_legacy_candidates lc where lc.request_id = tr.id)
          and not exists (select 1 from public.transport_request_legacy_completions audit where audit.request_id = tr.id),
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
            'loading_bay', le.loading_bay,
            'notes', le.notes
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
