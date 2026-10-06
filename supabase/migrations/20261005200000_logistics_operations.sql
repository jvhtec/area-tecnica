-- Additive management data. Existing request/plan RPCs remain authoritative for status and reservations.
create table public.logistics_operations (
  entity_kind text not null check (entity_kind in ('material','personnel')),
  entity_id uuid not null,
  responsible_id uuid references public.profiles(id) on delete set null,
  transport_cost numeric(12,2) check (transport_cost between 0 and 10000000),
  hotel_cost numeric(12,2) check (hotel_cost between 0 and 10000000),
  other_cost numeric(12,2) check (other_cost between 0 and 10000000),
  cost_notes text not null default '' check (length(cost_notes) <= 2000),
  in_progress boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(entity_kind,entity_id)
);
create index logistics_operations_owner_idx on public.logistics_operations(responsible_id);
create table public.logistics_operation_history (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null check (entity_kind in ('material','personnel')),
  entity_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default clock_timestamp(),
  action text not null,
  before_data jsonb,
  after_data jsonb
);
create index logistics_history_entity_idx on public.logistics_operation_history(entity_kind,entity_id,changed_at desc);
alter table public.logistics_operations enable row level security;
alter table public.logistics_operation_history enable row level security;
revoke all on public.logistics_operations, public.logistics_operation_history from public,anon,authenticated;
grant select on public.logistics_operations, public.logistics_operation_history to authenticated;
grant all on public.logistics_operations, public.logistics_operation_history to service_role;
create policy operations_read on public.logistics_operations for select to authenticated using(public.logistics_matrix_can_view());
create policy operations_history_read on public.logistics_operation_history for select to authenticated using(public.logistics_matrix_can_view());

create function public.list_logistics_operations() returns jsonb
language plpgsql stable security definer set search_path = public,pg_temp as $$
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then raise exception 'No tienes permiso para consultar logística.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object('responsible_name',nullif(concat_ws(' ',p.first_name,p.last_name),''))) from public.logistics_operations o left join public.profiles p on p.id=o.responsible_id), '[]'::jsonb);
end;
$$;
revoke all on function public.list_logistics_operations() from public,anon;
grant execute on function public.list_logistics_operations() to authenticated,service_role;

create function public.list_logistics_responsibles() returns jsonb
language plpgsql stable security definer set search_path = public,pg_temp as $$
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then raise exception 'No tienes permiso para consultar logística.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(concat_ws(' ',p.first_name,p.last_name),''),p.nickname,'Sin nombre')) order by p.first_name,p.id) from public.profiles p where p.department='logistics' or p.role::text in ('admin','management')),'[]'::jsonb);
end;
$$;
revoke all on function public.list_logistics_responsibles() from public,anon;
grant execute on function public.list_logistics_responsibles() to authenticated,service_role;

create function public.save_logistics_operation(p_input jsonb,p_expected_updated_at timestamptz default null) returns void
language plpgsql security definer set search_path = public,pg_temp as $$
declare
  v_kind text := p_input->>'entity_kind';
  v_id uuid := (p_input->>'entity_id')::uuid;
  v_status text;
  v_previous public.logistics_operations;
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then raise exception 'Solo gestión puede modificar este servicio.' using errcode='42501'; end if;
  if v_id is null or v_kind is null or v_kind not in ('material','personnel') then raise exception 'Servicio no válido.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('logistics-operations:' || v_kind || ':' || v_id::text,0));
  -- Lock the parent too so confirmation cannot change concurrently with starting a service.
  if v_kind='material' then
    select planning_status into v_status from public.transport_requests where id=v_id for update;
  else
    select status into v_status from public.personnel_logistics_plans where id=v_id for update;
  end if;
  if not found then raise exception 'El servicio ya no existe.' using errcode='22023'; end if;
  if coalesce((p_input->>'in_progress')::boolean,false) and v_status <> 'confirmed' then raise exception 'Confirma el servicio antes de marcarlo en curso.' using errcode='22023'; end if;
  select * into v_previous from public.logistics_operations where entity_kind=v_kind and entity_id=v_id for update;
  if (found and p_expected_updated_at is distinct from v_previous.updated_at) or (not found and p_expected_updated_at is not null) then raise exception 'Otra persona ha actualizado el servicio. Recarga antes de guardar.' using errcode='40001'; end if;
  insert into public.logistics_operations(entity_kind,entity_id,responsible_id,transport_cost,hotel_cost,other_cost,cost_notes,in_progress)
  values(v_kind,v_id,nullif(p_input->>'responsible_id','')::uuid,(p_input->>'transport_cost')::numeric,(p_input->>'hotel_cost')::numeric,(p_input->>'other_cost')::numeric,coalesce(p_input->>'cost_notes',''),coalesce((p_input->>'in_progress')::boolean,false))
  on conflict(entity_kind,entity_id) do update set responsible_id=excluded.responsible_id,transport_cost=excluded.transport_cost,hotel_cost=excluded.hotel_cost,other_cost=excluded.other_cost,cost_notes=excluded.cost_notes,in_progress=excluded.in_progress,updated_at=clock_timestamp();
end;
$$;
revoke all on function public.save_logistics_operation(jsonb,timestamptz) from public,anon;
grant execute on function public.save_logistics_operation(jsonb,timestamptz) to authenticated,service_role;

create function public.list_logistics_operation_history(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public,pg_temp as $$
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then raise exception 'No tienes permiso para consultar el historial.' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('material','personnel') or p_id is null then raise exception 'Servicio no válido.' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(to_jsonb(h) || jsonb_build_object('actor_name',nullif(concat_ws(' ',p.first_name,p.last_name),'')) order by h.changed_at desc,h.id) from public.logistics_operation_history h left join public.profiles p on p.id=h.actor_id where h.entity_kind=p_kind and h.entity_id=p_id),'[]'::jsonb);
end;
$$;
revoke all on function public.list_logistics_operation_history(text,uuid) from public,anon;
grant execute on function public.list_logistics_operation_history(text,uuid) to authenticated,service_role;

create function public.capture_logistics_operation_history() returns trigger
language plpgsql security definer set search_path = public,pg_temp as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_kind text; v_id uuid;
begin
  if TG_OP <> 'INSERT' then v_old := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new,v_old);
  if TG_TABLE_NAME='logistics_operations' then v_kind:=v_row->>'entity_kind'; v_id:=(v_row->>'entity_id')::uuid;
  elsif TG_TABLE_NAME='personnel_logistics_plans' then v_kind:='personnel'; v_id:=(v_row->>'id')::uuid;
  elsif TG_TABLE_NAME='transport_requests' then v_kind:='material'; v_id:=(v_row->>'id')::uuid;
  elsif TG_TABLE_NAME='logistics_events' then
    v_id:=nullif(v_row->>'transport_request_id','')::uuid;
    if v_id is not null then v_kind:='material';
    else select id into v_id from public.personnel_logistics_plans where event_id=(v_row->>'id')::uuid; v_kind:='personnel'; end if;
  else
    select id into v_id from public.personnel_logistics_plans where event_id=(v_row->>'logistics_event_id')::uuid;
    if v_id is not null then v_kind:='personnel';
    else select transport_request_id into v_id from public.logistics_events where id=(v_row->>'logistics_event_id')::uuid; v_kind:='material'; end if;
  end if;
  if v_id is not null and v_old is distinct from v_new then
    insert into public.logistics_operation_history(entity_kind,entity_id,actor_id,action,before_data,after_data) values(v_kind,v_id,auth.uid(),TG_OP,v_old,v_new);
  end if;
  if TG_TABLE_NAME in ('personnel_logistics_plans','transport_requests') and TG_OP='UPDATE' and (v_new->>'status' <> 'confirmed' and TG_TABLE_NAME='personnel_logistics_plans' or v_new->>'planning_status' <> 'confirmed' and TG_TABLE_NAME='transport_requests') then
    update public.logistics_operations set in_progress=false,updated_at=clock_timestamp() where entity_kind=v_kind and entity_id=v_id and in_progress;
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function public.capture_logistics_operation_history() from public,anon,authenticated;
grant execute on function public.capture_logistics_operation_history() to service_role;
create trigger logistics_metadata_history after insert or update or delete on public.logistics_operations for each row execute function public.capture_logistics_operation_history();
create trigger logistics_personnel_history after insert or update or delete on public.personnel_logistics_plans for each row execute function public.capture_logistics_operation_history();
create trigger logistics_material_history after insert or update or delete on public.transport_requests for each row execute function public.capture_logistics_operation_history();
create trigger logistics_calendar_history after insert or update or delete on public.logistics_events for each row execute function public.capture_logistics_operation_history();
create trigger logistics_assignments_history after insert or update or delete on public.transport_driver_assignments for each row execute function public.capture_logistics_operation_history();
