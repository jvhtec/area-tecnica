-- Use the existing availability model consumed by the driver matrix.
create function public.set_logistics_driver_leave(p_driver uuid,p_start date,p_end date,p_status text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then raise exception 'No tienes permiso para gestionar descansos.' using errcode='42501'; end if;
  if p_driver is null or p_start is null or p_end is null or p_end < p_start or p_end-p_start > 366 or p_status is null or p_status not in ('vacation','day_off','clear') then raise exception 'Selecciona un periodo válido de hasta 367 días.' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=p_driver and role::text='conductor') then raise exception 'Conductor no válido.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('driver-leave:'||p_driver::text,0));
  if exists(select 1 from public.vacation_requests where technician_id=p_driver and status='approved' and start_date<=p_end and end_date>=p_start) then raise exception 'El periodo coincide con vacaciones aprobadas. Modifícalas desde su gestión de vacaciones.' using errcode='22023'; end if;
  if exists(select 1 from public.technician_availability where technician_id=p_driver::text and date between p_start and p_end and status not in ('day_off','vacation')) then raise exception 'El periodo contiene otra ausencia. Revisa la disponibilidad antes de cambiarlo.' using errcode='22023'; end if;
  if p_status='clear' then
    delete from public.technician_availability where technician_id=p_driver::text and date between p_start and p_end and status in ('day_off','vacation');
  else
    insert into public.technician_availability(technician_id,date,status)
      select p_driver::text,d::date,p_status from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
      on conflict(technician_id,date) do update set status=excluded.status,updated_at=clock_timestamp();
  end if;
end;
$$;
revoke all on function public.set_logistics_driver_leave(uuid,date,date,text) from public,anon;
grant execute on function public.set_logistics_driver_leave(uuid,date,date,text) to authenticated,service_role;
