-- Preserve the existing implementation while enforcing one public save path.
alter function public.save_personnel_logistics_plan(jsonb,timestamptz) rename to save_personnel_logistics_plan_internal;
revoke all on function public.save_personnel_logistics_plan_internal(jsonb,timestamptz) from public,anon,authenticated;
create function public.save_personnel_logistics_plan(p_plan jsonb,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v public.personnel_logistics_plans;
  old_plan public.personnel_logistics_plans;
  legacy_id uuid := nullif(p_plan->>'legacy_event_id','')::uuid;
  assigned_id uuid;
  new_id uuid;
  revision timestamptz;
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then raise exception 'Solo administración y gestión pueden modificar logística de personal.' using errcode='42501'; end if;
  v := jsonb_populate_record(null::public.personnel_logistics_plans,p_plan);
  if v.id is not null then select * into old_plan from public.personnel_logistics_plans where id=v.id; end if;
  if coalesce(v.hotel_needed,false) and exists(select 1 from public.jobs where id=v.job_id and tour_id is not null) then
    if old_plan.id is null or not old_plan.hotel_needed then raise exception 'El alojamiento de una gira se registra desde Giras.' using errcode='22023'; end if;
    if row(v.hotel_name,v.hotel_address,v.hotel_check_in,v.hotel_check_out,v.single_rooms,v.double_rooms,v.hotel_status) is distinct from row(old_plan.hotel_name,old_plan.hotel_address,old_plan.hotel_check_in,old_plan.hotel_check_out,old_plan.single_rooms,old_plan.double_rooms,old_plan.hotel_status) then raise exception 'Concilia el alojamiento anterior con Giras antes de cambiarlo.' using errcode='22023'; end if;
  end if;
  if legacy_id is not null and v.id is null then
    perform 1 from public.logistics_events where id=legacy_id and event_type='crew_transfer' for update;
    if not found then raise exception 'El traslado antiguo ya no existe.' using errcode='22023'; end if;
    if exists(select 1 from public.personnel_logistics_plans where event_id=legacy_id) then raise exception 'Este movimiento ya tiene una ficha. Recarga para abrirla.' using errcode='40001'; end if;
    select id into assigned_id from public.transport_driver_assignments where logistics_event_id=legacy_id order by starts_at limit 1;
    if (select count(*) from public.transport_driver_assignments where logistics_event_id=legacy_id)>1 then raise exception 'El movimiento tiene varias asignaciones. Revisa su vinculación antes de continuar.' using errcode='22023'; end if;
    insert into public.personnel_logistics_plans(title,job_id,people_count,starts_at,ends_at,origin_location_id,destination_location_id,driver_id,vehicle_id,event_id,assignment_id,status,hotel_needed,hotel_name,hotel_address,hotel_check_in,hotel_check_out,single_rooms,double_rooms,hotel_status,notes,created_by)
    values(v.title,v.job_id,v.people_count,v.starts_at,v.ends_at,v.origin_location_id,v.destination_location_id,v.driver_id,v.vehicle_id,legacy_id,assigned_id,v.status,coalesce(v.hotel_needed,false),v.hotel_name,v.hotel_address,v.hotel_check_in,v.hotel_check_out,coalesce(v.single_rooms,0),coalesce(v.double_rooms,0),coalesce(v.hotel_status,'pending'),v.notes,auth.uid())
    returning id,updated_at into new_id,revision;
    return public.save_personnel_logistics_plan_internal(p_plan||jsonb_build_object('id',new_id),revision);
  end if;
  return public.save_personnel_logistics_plan_internal(p_plan,p_expected_updated_at);
end;
$$;
revoke all on function public.save_personnel_logistics_plan(jsonb,timestamptz) from public,anon;
grant execute on function public.save_personnel_logistics_plan(jsonb,timestamptz) to authenticated,service_role;
