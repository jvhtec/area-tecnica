-- Make the WhatsApp quota check-and-record atomic. The edge-function helper
-- previously did SELECT-sum then INSERT as two round trips, so a burst of
-- concurrent requests could all pass the check before any ledger row landed
-- and overshoot the daily quota. This RPC serializes per actor+kind with a
-- transaction-scoped advisory lock and does the count + conditional insert
-- in one transaction.

create or replace function public.attempt_whatsapp_send(
  _actor_id uuid,
  _kind text,
  _units integer,
  _daily_limit integer,
  _job_id uuid default null,
  _recipient_count integer default 0
) returns table(allowed boolean, used_today integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer := 0;
begin
  if _kind not in ('job_message', 'group_creation') then
    raise exception 'invalid whatsapp quota kind: %', _kind;
  end if;

  -- Serialize concurrent checks for the same actor+kind until commit.
  perform pg_advisory_xact_lock(hashtext(_actor_id::text || ':' || _kind));

  select case
           when _kind = 'job_message' then coalesce(sum(a.recipient_count), 0)::integer
           else count(*)::integer
         end
    into v_used
    from public.whatsapp_send_audit a
   where a.actor_id = _actor_id
     and a.kind = _kind
     and a.created_at >= now() - interval '24 hours';

  if v_used + greatest(_units, 0) > _daily_limit then
    return query select false, v_used;
    return;
  end if;

  insert into public.whatsapp_send_audit (actor_id, kind, job_id, recipient_count)
  values (_actor_id, _kind, _job_id, _recipient_count);

  return query select true, v_used;
end;
$$;

comment on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer)
  is 'Atomic per-actor daily quota check + ledger insert for the WhatsApp edge functions.';

revoke all on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer) from public;
revoke all on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer) from anon;
revoke all on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer) from authenticated;
grant execute on function public.attempt_whatsapp_send(uuid, text, integer, integer, uuid, integer) to service_role;
