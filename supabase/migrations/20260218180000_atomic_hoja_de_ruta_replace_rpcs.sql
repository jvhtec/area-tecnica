-- Atomic replace helpers for hoja de ruta child tables.
-- Each function wraps DELETE + INSERT in a single DB transaction scope.

create or replace function public.replace_hoja_de_ruta_transport(
  p_hoja_de_ruta_id uuid,
  p_rows jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.hoja_de_ruta_transport
  where hoja_de_ruta_id = p_hoja_de_ruta_id;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 0 then
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
      x.transport_type,
      x.driver_name,
      x.driver_phone,
      x.license_plate,
      x.company,
      x.date_time,
      x.has_return,
      x.return_date_time
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
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
  p_rows jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.hoja_de_ruta_contacts
  where hoja_de_ruta_id = p_hoja_de_ruta_id;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 0 then
    insert into public.hoja_de_ruta_contacts (
      hoja_de_ruta_id,
      name,
      role,
      phone,
      technician_id
    )
    select
      p_hoja_de_ruta_id,
      x.name,
      x.role,
      x.phone,
      x.technician_id
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
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
  p_rows jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.hoja_de_ruta_staff
  where hoja_de_ruta_id = p_hoja_de_ruta_id;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 0 then
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
      x.technician_id,
      x.name,
      x.surname1,
      x.surname2,
      x.position,
      x.dni
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
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
