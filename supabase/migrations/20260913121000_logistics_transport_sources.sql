-- Source normalization and compatibility for existing generators.

update public.transport_requests
set planning_status = case
  when status = 'cancelled' then 'cancelled'
  when status = 'fulfilled' then 'completed'
  else planning_status
end
where (status = 'cancelled' and planning_status <> 'cancelled')
   or (status = 'fulfilled' and planning_status <> 'completed');

update public.transport_requests
set source_type = 'subrental',
    source_ref = subrental_id::text
where subrental_id is not null
  and (source_type <> 'subrental' or source_ref is distinct from subrental_id::text);

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

drop trigger if exists normalize_transport_request_source on public.transport_requests;
create trigger normalize_transport_request_source
before insert or update of subrental_id on public.transport_requests
for each row execute function public.normalize_transport_request_source();

-- TourLogisticsDialog is the only caller of this legacy RPC. Keep its public signature
-- stable, but make it source-owned so it can never overwrite a manual request just because
-- that request happens to be the first row returned for the same job/department.
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
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_department not in ('sound', 'lights', 'video') then
    raise exception 'Invalid department' using errcode = '22023';
  end if;
  if not (
    public.transport_request_is_privileged()
    or (public.get_current_user_role() = 'house_tech' and public.current_user_department() = p_department)
  ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  -- Trust a supplied id only when it is already owned by the tour generator.
  if p_request_id is not null then
    select source_type into v_existing_source
    from public.transport_requests
    where id = p_request_id
      and job_id = p_job_id
      and department = p_department
      and planning_status not in ('completed', 'cancelled');

    if v_existing_source = 'tour' then
      v_request_id := p_request_id;
    end if;
  end if;

  if v_request_id is null then
    select id into v_request_id
    from public.transport_requests
    where job_id = p_job_id
      and department = p_department
      and source_type = 'tour'
      and source_ref = p_job_id::text
      and planning_status not in ('completed', 'cancelled')
    limit 1;
  end if;

  if v_request_id is null then
    insert into public.transport_requests(
      job_id, department, note, status, created_by,
      source_type, source_ref, planning_status, is_hoja_relevant
    ) values (
      p_job_id, p_department, nullif(trim(p_note), ''), 'requested', coalesce(p_created_by, v_actor),
      'tour', p_job_id::text, 'requested', true
    ) returning id into v_request_id;
  else
    update public.transport_requests
    set note = nullif(trim(p_note), ''),
        source_type = 'tour',
        source_ref = p_job_id::text,
        status = case when planning_status in ('completed', 'cancelled') then status else 'requested' end,
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
  where item.transport_type in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta');

  return v_request_id;
end;
$$;

revoke all on function public.replace_transport_request_with_items(uuid, uuid, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.replace_transport_request_with_items(uuid, uuid, text, text, text, uuid, jsonb) to authenticated, service_role;
