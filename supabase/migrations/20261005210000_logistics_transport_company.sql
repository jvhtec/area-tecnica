-- Empresa que realizó el transporte; conserva permisos e historial existentes.
ALTER TABLE public.logistics_operations ADD COLUMN transport_company text NOT NULL DEFAULT '' CHECK (length(transport_company) <= 200);

create or replace function public.save_logistics_operation(p_input jsonb,p_expected_updated_at timestamptz default null) returns void
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
  insert into public.logistics_operations(entity_kind,entity_id,responsible_id,transport_cost,hotel_cost,other_cost,cost_notes,in_progress,transport_company)
  values(v_kind,v_id,nullif(p_input->>'responsible_id','')::uuid,(p_input->>'transport_cost')::numeric,(p_input->>'hotel_cost')::numeric,(p_input->>'other_cost')::numeric,coalesce(p_input->>'cost_notes',''),coalesce((p_input->>'in_progress')::boolean,false),case when p_input ? 'transport_company' then btrim(coalesce(p_input->>'transport_company','')) else coalesce(v_previous.transport_company,'') end)
  on conflict(entity_kind,entity_id) do update set responsible_id=excluded.responsible_id,transport_cost=excluded.transport_cost,hotel_cost=excluded.hotel_cost,other_cost=excluded.other_cost,cost_notes=excluded.cost_notes,in_progress=excluded.in_progress,transport_company=excluded.transport_company,updated_at=clock_timestamp();
end;
$$;
revoke all on function public.save_logistics_operation(jsonb,timestamptz) from public,anon;
grant execute on function public.save_logistics_operation(jsonb,timestamptz) to authenticated,service_role;


