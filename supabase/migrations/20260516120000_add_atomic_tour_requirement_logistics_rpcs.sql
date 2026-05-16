create or replace function public.replace_job_required_roles(
  p_job_id uuid,
  p_departments text[],
  p_rows jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_job_id is null then
    raise exception 'p_job_id is required';
  end if;

  if p_departments is null or array_length(p_departments, 1) is null then
    raise exception 'p_departments is required';
  end if;

  delete from public.job_required_roles
  where job_id = p_job_id
    and department = any(p_departments);

  insert into public.job_required_roles (
    job_id,
    department,
    role_code,
    quantity,
    notes
  )
  select
    p_job_id,
    r.department,
    r.role_code,
    greatest(coalesce(r.quantity, 0), 0),
    r.notes
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
    department text,
    role_code text,
    quantity integer,
    notes text
  )
  where r.department = any(p_departments)
    and coalesce(r.role_code, '') <> ''
    and coalesce(r.quantity, 0) > 0;
end;
$$;

grant execute on function public.replace_job_required_roles(uuid, text[], jsonb) to authenticated;
grant execute on function public.replace_job_required_roles(uuid, text[], jsonb) to service_role;

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
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if p_job_id is null then
    raise exception 'p_job_id is required';
  end if;

  if coalesce(p_department, '') = '' then
    raise exception 'p_department is required';
  end if;

  if p_created_by is null then
    raise exception 'p_created_by is required';
  end if;

  if p_request_id is null then
    insert into public.transport_requests (
      job_id,
      department,
      note,
      status,
      created_by
    )
    values (
      p_job_id,
      p_department,
      p_note,
      coalesce(nullif(p_status, ''), 'requested'),
      p_created_by
    )
    returning id into v_request_id;
  else
    update public.transport_requests
    set
      job_id = p_job_id,
      department = p_department,
      note = p_note,
      status = coalesce(nullif(p_status, ''), status),
      created_by = p_created_by,
      updated_at = now()
    where id = p_request_id
    returning id into v_request_id;

    if v_request_id is null then
      raise exception 'transport request % not found', p_request_id;
    end if;

    delete from public.transport_request_items
    where request_id = v_request_id;
  end if;

  insert into public.transport_request_items (
    request_id,
    transport_type,
    leftover_space_meters
  )
  select
    v_request_id,
    r.transport_type,
    r.leftover_space_meters
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as r(
    transport_type text,
    leftover_space_meters numeric
  )
  where coalesce(r.transport_type, '') <> '';

  return v_request_id;
end;
$$;

grant execute on function public.replace_transport_request_with_items(uuid, uuid, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.replace_transport_request_with_items(uuid, uuid, text, text, text, uuid, jsonb) to service_role;
