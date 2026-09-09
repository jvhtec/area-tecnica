-- Service API keys are authorized by PostgREST as the service_role database
-- role, but they do not necessarily populate the legacy JWT claim setting.
-- EXECUTE remains restricted to service_role, so the claim checks inside these
-- SECURITY DEFINER functions were both redundant and incompatible with the
-- current hosted key path.

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
begin
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

  if v_operation.status = 'running' then
    if v_operation.lease_expires_at > now() then
      return query select v_operation.id, null::uuid, v_operation.status, false;
      return;
    end if;
    update public.flex_provisioning_operations
      set status = 'needs_reconciliation', lease_token = null, lease_expires_at = null,
          last_error = jsonb_build_object('code', 'lease_expired_after_remote_write'), updated_at = now()
      where id = v_operation.id;
    if not p_reconcile then
      return query select v_operation.id, null::uuid, 'needs_reconciliation'::text, false;
      return;
    end if;
  end if;

  if v_operation.status = 'needs_reconciliation' and not p_reconcile then
    return query select v_operation.id, null::uuid, v_operation.status, false;
    return;
  end if;

  update public.flex_provisioning_operations
    set status = 'running', lease_token = v_token,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        requested_by = coalesce(requested_by, p_requested_by),
        completed_at = null, last_error = null, updated_at = now()
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
