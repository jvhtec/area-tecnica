-- Atomic replacement helpers for hoja de ruta child tables

create or replace function public.replace_hoja_de_ruta_transport(
  p_hoja_de_ruta_id uuid,
  p_transport_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.hoja_de_ruta_transport
  where hoja_de_ruta_id = p_hoja_de_ruta_id;

  if coalesce(jsonb_typeof(p_transport_rows), 'null') = 'array'
     and jsonb_array_length(coalesce(p_transport_rows, '[]'::jsonb)) > 0 then
    insert into public.hoja_de_ruta_transport (
      hoja_de_ruta_id,
      transport_type,
      driver_name,
      driver_phone,
      license_plate,
      company,
      date_time,
      has_return,
      return_date_time
    )
    select
      p_hoja_de_ruta_id,
      r.transport_type,
      r.driver_name,
      r.driver_phone,
      r.license_plate,
      r.company,
      r.date_time,
      coalesce(r.has_return, false),
      r.return_date_time
    from jsonb_to_recordset(coalesce(p_transport_rows, '[]'::jsonb)) as r(
      transport_type text,
      driver_name text,
      driver_phone text,
      license_plate text,
      company text,
      date_time timestamptz,
      has_return boolean,
      return_date_time timestamptz
    );
  end if;
end;
$$;

create or replace function public.replace_hoja_de_ruta_contacts(
  p_hoja_de_ruta_id uuid,
  p_contact_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.hoja_de_ruta_contacts
  where hoja_de_ruta_id = p_hoja_de_ruta_id;

  if coalesce(jsonb_typeof(p_contact_rows), 'null') = 'array'
     and jsonb_array_length(coalesce(p_contact_rows, '[]'::jsonb)) > 0 then
    insert into public.hoja_de_ruta_contacts (
      hoja_de_ruta_id,
      name,
      role,
      phone,
      technician_id
    )
    select
      p_hoja_de_ruta_id,
      r.name,
      r.role,
      r.phone,
      r.technician_id
    from jsonb_to_recordset(coalesce(p_contact_rows, '[]'::jsonb)) as r(
      name text,
      role text,
      phone text,
      technician_id uuid
    );
  end if;
end;
$$;

create or replace function public.replace_hoja_de_ruta_staff(
  p_hoja_de_ruta_id uuid,
  p_staff_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.hoja_de_ruta_staff
  where hoja_de_ruta_id = p_hoja_de_ruta_id;

  if coalesce(jsonb_typeof(p_staff_rows), 'null') = 'array'
     and jsonb_array_length(coalesce(p_staff_rows, '[]'::jsonb)) > 0 then
    insert into public.hoja_de_ruta_staff (
      hoja_de_ruta_id,
      technician_id,
      name,
      surname1,
      surname2,
      position,
      dni
    )
    select
      p_hoja_de_ruta_id,
      r.technician_id,
      r.name,
      r.surname1,
      r.surname2,
      r.position,
      r.dni
    from jsonb_to_recordset(coalesce(p_staff_rows, '[]'::jsonb)) as r(
      technician_id uuid,
      name text,
      surname1 text,
      surname2 text,
      position text,
      dni text
    );
  end if;
end;
$$;

create or replace function public.replace_hoja_de_ruta_all(
  p_hoja_de_ruta_id uuid,
  p_transport_rows jsonb,
  p_contact_rows jsonb,
  p_staff_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.replace_hoja_de_ruta_transport(p_hoja_de_ruta_id, p_transport_rows);
  perform public.replace_hoja_de_ruta_contacts(p_hoja_de_ruta_id, p_contact_rows);
  perform public.replace_hoja_de_ruta_staff(p_hoja_de_ruta_id, p_staff_rows);
end;
$$;

grant execute on function public.replace_hoja_de_ruta_transport(uuid, jsonb) to authenticated;
grant execute on function public.replace_hoja_de_ruta_contacts(uuid, jsonb) to authenticated;
grant execute on function public.replace_hoja_de_ruta_staff(uuid, jsonb) to authenticated;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to authenticated;
