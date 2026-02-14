-- Keep Hoja de Ruta staff/contacts in sync when an assignment is removed.
-- This prevents stale technicians from lingering in the Hoja de Ruta after de-assignment.

create or replace function public.remove_assignment_with_timesheets(
  p_job_id uuid,
  p_technician_id uuid
)
returns table(deleted_timesheets integer, deleted_assignment boolean)
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_deleted_timesheets int := 0;
  v_assignment_rows int := 0;
  v_deleted_assignment boolean := false;
  v_first_name text;
  v_last_name text;
begin
  if not (auth.role() = 'service_role' or public.is_admin_or_management()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from public.timesheets
  where job_id = p_job_id
    and technician_id = p_technician_id;

  get diagnostics v_deleted_timesheets = row_count;

  delete from public.job_assignments
  where job_id = p_job_id
    and technician_id = p_technician_id;

  get diagnostics v_assignment_rows = row_count;
  v_deleted_assignment := v_assignment_rows > 0;

  -- If the assignment was deleted, also remove any auto-linked Hoja de Ruta entries.
  if v_deleted_assignment then
    select first_name, last_name
      into v_first_name, v_last_name
    from public.profiles
    where id = p_technician_id;

    if v_first_name is null or v_last_name is null then
      raise warning 'remove_assignment_with_timesheets: profile not found or missing name for technician_id=%', p_technician_id;
    end if;

    -- Prefer reliable technician_id match; fall back to name/surname for legacy rows.
    delete from public.hoja_de_ruta_staff s
    using public.hoja_de_ruta h
    where h.job_id = p_job_id
      and s.hoja_de_ruta_id = h.id
      and (
        s.technician_id = p_technician_id
        or (
          v_first_name is not null
          and v_last_name is not null
          and lower(coalesce(s.name, '')) = lower(coalesce(v_first_name, ''))
          and lower(coalesce(s.surname1, '')) = lower(coalesce(v_last_name, ''))
        )
      );

    delete from public.hoja_de_ruta_contacts c
    using public.hoja_de_ruta h
    where h.job_id = p_job_id
      and c.hoja_de_ruta_id = h.id
      and (
        c.technician_id = p_technician_id
        or (
          v_first_name is not null
          and v_last_name is not null
          and lower(coalesce(c.name, '')) = lower(trim(coalesce(v_first_name, '') || ' ' || coalesce(v_last_name, '')))
        )
      );
  end if;

  return query select v_deleted_timesheets, v_deleted_assignment;
end;
$$;

comment on function public.remove_assignment_with_timesheets(uuid, uuid)
  is 'Removes an assignment and all associated timesheets. Also removes linked Hoja de Ruta staff/contacts rows for that technician. Returns count of deleted timesheets and whether assignment was deleted.';
