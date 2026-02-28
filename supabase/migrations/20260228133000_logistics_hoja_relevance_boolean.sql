-- Boolean-only Hoja relevance for logistics integration

-- 1) logistics_events: relevance flag used by Hoja import filter
alter table public.logistics_events
  add column if not exists is_hoja_relevant boolean not null default true;

update public.logistics_events
set is_hoja_relevant = true
where is_hoja_relevant is distinct from true;

-- 2) hoja_de_ruta_transport: linkage + local relevance copy/editable value
alter table public.hoja_de_ruta_transport
  add column if not exists source_logistics_event_id uuid;

alter table public.hoja_de_ruta_transport
  add column if not exists is_hoja_relevant boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hoja_de_ruta_transport_source_logistics_event_id_fkey'
      and conrelid = 'public.hoja_de_ruta_transport'::regclass
  ) then
    alter table public.hoja_de_ruta_transport
      add constraint hoja_de_ruta_transport_source_logistics_event_id_fkey
      foreign key (source_logistics_event_id)
      references public.logistics_events(id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists idx_hoja_de_ruta_transport_unique_source_event
  on public.hoja_de_ruta_transport (hoja_de_ruta_id, source_logistics_event_id)
  where source_logistics_event_id is not null;

-- 3) Extend transport replace helper with new fields and sync source event relevance
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
      is_hoja_relevant
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
      coalesce(r.is_hoja_relevant, true)
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
      is_hoja_relevant boolean
    );

    -- Keep source logistics event relevance in sync for imported/linked rows.
    update public.logistics_events le
    set
      is_hoja_relevant = ht.is_hoja_relevant,
      updated_at = now()
    from public.hoja_de_ruta_transport ht
    where ht.hoja_de_ruta_id = p_hoja_de_ruta_id
      and ht.source_logistics_event_id is not null
      and le.id = ht.source_logistics_event_id;
  end if;
end;
$$;
