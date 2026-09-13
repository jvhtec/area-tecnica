-- House techs may view the complete logistics workspace, but transport authority remains
-- strictly admin/management. This migration changes only the read model.

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
