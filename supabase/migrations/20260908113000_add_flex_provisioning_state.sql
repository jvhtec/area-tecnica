create table public.flex_provisioning_operations (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  operation_type text not null check (operation_type in ('job', 'tour-root', 'tour-date', 'dryhire-year', 'festival-artist-extras')),
  scope_id text not null,
  status text not null default 'planned' check (status in ('planned', 'running', 'partial', 'needs_reconciliation', 'complete', 'failed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  requested_by uuid references auth.users(id) on delete set null,
  sequence_group text,
  sequence_number integer check (sequence_number > 0),
  last_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index flex_provisioning_operations_sequence_idx
  on public.flex_provisioning_operations (operation_type, sequence_group, sequence_number)
  where sequence_group is not null and sequence_number is not null;

create table public.flex_provisioning_nodes (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.flex_provisioning_operations(id) on delete cascade,
  semantic_key text not null,
  parent_key text,
  state text not null default 'planned' check (state in ('planned', 'creating', 'persisted', 'needs_reconciliation', 'failed')),
  element_id uuid,
  tracking_row_id uuid references public.flex_folders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  safe_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_id, semantic_key)
);

create index flex_provisioning_nodes_state_idx
  on public.flex_provisioning_nodes (operation_id, state);

alter table public.flex_provisioning_operations enable row level security;
alter table public.flex_provisioning_nodes enable row level security;

create policy flex_provisioning_operations_management_read
  on public.flex_provisioning_operations for select to authenticated
  using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

create policy flex_provisioning_nodes_management_read
  on public.flex_provisioning_nodes for select to authenticated
  using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

grant select on public.flex_provisioning_operations to authenticated;
grant select on public.flex_provisioning_nodes to authenticated;
grant all on public.flex_provisioning_operations to service_role;
grant all on public.flex_provisioning_nodes to service_role;

create or replace function public.acquire_flex_provisioning_lease(
  p_scope_key text,
  p_operation_type text,
  p_scope_id text,
  p_lease_seconds integer default 120,
  p_reconcile boolean default false,
  p_requested_by uuid default null
)
returns table(operation_id uuid, lease_token uuid, status text, acquired boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.flex_provisioning_operations%rowtype;
  v_token uuid := gen_random_uuid();
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  if v_jwt_role is distinct from 'service_role' then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;
  if p_scope_key is null or length(trim(p_scope_key)) = 0 or p_lease_seconds not between 30 and 900 then
    raise exception 'invalid provisioning lease input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope_key, 0));
  select * into v_operation from public.flex_provisioning_operations where scope_key = p_scope_key for update;

  if not found then
    insert into public.flex_provisioning_operations (
      scope_key, operation_type, scope_id, status, lease_token, lease_expires_at, requested_by
    ) values (
      p_scope_key, p_operation_type, p_scope_id, 'running', v_token,
      now() + make_interval(secs => p_lease_seconds), p_requested_by
    ) returning * into v_operation;
    return query select v_operation.id, v_token, v_operation.status, true;
    return;
  end if;

  if v_operation.status = 'complete' then
    return query select v_operation.id, null::uuid, v_operation.status, false;
    return;
  end if;

  if v_operation.status = 'running' then
    if v_operation.lease_expires_at > now() then
      return query select v_operation.id, null::uuid, v_operation.status, false;
      return;
    end if;
    update public.flex_provisioning_operations
      set status = 'needs_reconciliation', lease_token = null, lease_expires_at = null,
          last_error = jsonb_build_object('code', 'lease_expired_after_remote_write'), updated_at = now()
      where id = v_operation.id;
    return query select v_operation.id, null::uuid, 'needs_reconciliation'::text, false;
    return;
  end if;

  if v_operation.status = 'needs_reconciliation' and not p_reconcile then
    return query select v_operation.id, null::uuid, v_operation.status, false;
    return;
  end if;

  update public.flex_provisioning_operations
    set status = 'running', lease_token = v_token,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        requested_by = coalesce(requested_by, p_requested_by), updated_at = now()
    where id = v_operation.id;
  return query select v_operation.id, v_token, 'running'::text, true;
end
$function$;

create or replace function public.allocate_flex_provisioning_sequence(
  p_operation_id uuid,
  p_sequence_group text,
  p_minimum integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.flex_provisioning_operations%rowtype;
  v_sequence integer;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;
  if p_sequence_group is null or length(trim(p_sequence_group)) = 0 or p_minimum < 1 then
    raise exception 'invalid provisioning sequence input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('flex-sequence:' || p_sequence_group, 0));
  select * into v_operation
    from public.flex_provisioning_operations
    where id = p_operation_id
    for update;
  if not found then
    raise exception 'provisioning operation not found' using errcode = 'P0002';
  end if;
  if v_operation.sequence_number is not null then
    return v_operation.sequence_number;
  end if;

  select greatest(
    p_minimum,
    coalesce(max(sequence_number) + 1, 1)
  ) into v_sequence
  from public.flex_provisioning_operations
  where operation_type = v_operation.operation_type
    and sequence_group = p_sequence_group;

  update public.flex_provisioning_operations
    set sequence_group = p_sequence_group,
        sequence_number = v_sequence,
        updated_at = now()
    where id = p_operation_id;
  return v_sequence;
end
$function$;

create or replace function public.finish_flex_provisioning_lease(
  p_operation_id uuid,
  p_lease_token uuid,
  p_status text,
  p_last_error jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;
  if p_status not in ('partial', 'needs_reconciliation', 'complete', 'failed') then
    raise exception 'invalid provisioning status' using errcode = '22023';
  end if;
  update public.flex_provisioning_operations
    set status = p_status,
        lease_token = null,
        lease_expires_at = null,
        last_error = p_last_error,
        completed_at = case when p_status = 'complete' then now() else null end,
        updated_at = now()
    where id = p_operation_id and lease_token = p_lease_token and status = 'running';
  return found;
end
$function$;

revoke all on function public.acquire_flex_provisioning_lease(text, text, text, integer, boolean, uuid) from public, anon, authenticated;
revoke all on function public.allocate_flex_provisioning_sequence(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.finish_flex_provisioning_lease(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.acquire_flex_provisioning_lease(text, text, text, integer, boolean, uuid) to service_role;
grant execute on function public.allocate_flex_provisioning_sequence(uuid, text, integer) to service_role;
grant execute on function public.finish_flex_provisioning_lease(uuid, uuid, text, jsonb) to service_role;

comment on table public.flex_provisioning_operations is
  'Durable ownership and outcome state for non-transactional Flex provisioning.';
comment on table public.flex_provisioning_nodes is
  'Stable semantic node identities and remote-write reconciliation state.';
