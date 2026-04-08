-- Add structured auxiliary needs fields to hoja_de_ruta while keeping legacy free-text notes.

alter table public.hoja_de_ruta
  add column if not exists aux_staff_setup_qty integer;

alter table public.hoja_de_ruta
  add column if not exists aux_staff_dismantle_qty integer;

alter table public.hoja_de_ruta
  add column if not exists aux_machinery_requirements jsonb;

update public.hoja_de_ruta
set aux_staff_setup_qty = 0
where aux_staff_setup_qty is null or aux_staff_setup_qty < 0;

update public.hoja_de_ruta
set aux_staff_dismantle_qty = 0
where aux_staff_dismantle_qty is null or aux_staff_dismantle_qty < 0;

update public.hoja_de_ruta
set aux_machinery_requirements = '[]'::jsonb
where aux_machinery_requirements is null
   or jsonb_typeof(aux_machinery_requirements) <> 'array';

alter table public.hoja_de_ruta
  alter column aux_staff_setup_qty set default 0,
  alter column aux_staff_setup_qty set not null,
  alter column aux_staff_dismantle_qty set default 0,
  alter column aux_staff_dismantle_qty set not null,
  alter column aux_machinery_requirements set default '[]'::jsonb,
  alter column aux_machinery_requirements set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hoja_de_ruta_aux_staff_setup_qty_non_negative'
      and conrelid = 'public.hoja_de_ruta'::regclass
  ) then
    alter table public.hoja_de_ruta
      add constraint hoja_de_ruta_aux_staff_setup_qty_non_negative
      check (aux_staff_setup_qty >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'hoja_de_ruta_aux_staff_dismantle_qty_non_negative'
      and conrelid = 'public.hoja_de_ruta'::regclass
  ) then
    alter table public.hoja_de_ruta
      add constraint hoja_de_ruta_aux_staff_dismantle_qty_non_negative
      check (aux_staff_dismantle_qty >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'hoja_de_ruta_aux_machinery_requirements_is_array'
      and conrelid = 'public.hoja_de_ruta'::regclass
  ) then
    alter table public.hoja_de_ruta
      add constraint hoja_de_ruta_aux_machinery_requirements_is_array
      check (jsonb_typeof(aux_machinery_requirements) = 'array');
  end if;
end $$;
