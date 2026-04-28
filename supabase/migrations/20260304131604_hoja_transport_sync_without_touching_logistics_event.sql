-- Avoid touching logistics event rows when saving Hoja de Ruta transports,
-- unless Hoja-specific fields actually changed.
--
-- This keeps Hoja edits (e.g. driver info, Hoja datetime overrides) from
-- bumping `logistics_events.updated_at` and triggering scheduling-side updates.

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
      return_date_time,
      source_logistics_event_id,
      is_hoja_relevant,
      logistics_categories
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
      r.return_date_time,
      r.source_logistics_event_id,
      coalesce(r.is_hoja_relevant, true),
      coalesce(r.logistics_categories::public.logistics_transport_category[], '{}'::public.logistics_transport_category[])
    from jsonb_to_recordset(coalesce(p_transport_rows, '[]'::jsonb)) as r(
      transport_type text,
      driver_name text,
      driver_phone text,
      license_plate text,
      company text,
      date_time timestamptz,
      has_return boolean,
      return_date_time timestamptz,
      source_logistics_event_id uuid,
      is_hoja_relevant boolean,
      logistics_categories text[]
    );

    -- Keep source logistics event Hoja fields in sync for linked rows.
    -- Only update the scheduling event when these values actually differ.
    update public.logistics_events le
    set
      is_hoja_relevant = ht.is_hoja_relevant,
      hoja_categories = coalesce(ht.logistics_categories, '{}'::public.logistics_transport_category[]),
      updated_at = now()
    from public.hoja_de_ruta_transport ht
    where ht.hoja_de_ruta_id = p_hoja_de_ruta_id
      and ht.source_logistics_event_id is not null
      and le.id = ht.source_logistics_event_id
      and (
        le.is_hoja_relevant is distinct from ht.is_hoja_relevant
        or le.hoja_categories is distinct from coalesce(ht.logistics_categories, '{}'::public.logistics_transport_category[])
      );
  end if;
end;
$$;

