-- Sound truck-planner transport profile metadata and first external profile.
--
-- Milestone 1 is intentionally sound-only.  The existing truck_planner_case_skus
-- table remains the canonical set of physical transport objects consumed by the
-- packing engine.  These columns add provenance and the one constraint the old
-- model could not express: some carts occupy a real physical height but reserve
-- their entire XY column to the truck roof because nothing may travel above them.

alter table public.truck_planner_case_skus
  add column if not exists transport_kind text not null default 'case',
  add column if not exists blocks_vertical_column boolean not null default false,
  add column if not exists source_kind text not null default 'manual',
  add column if not exists source_url text,
  add column if not exists source_external_key text,
  add column if not exists source_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'truck_planner_case_skus_transport_kind_check'
  ) then
    alter table public.truck_planner_case_skus
      add constraint truck_planner_case_skus_transport_kind_check
      check (transport_kind = any (array[
        'case'::text,
        'cart'::text,
        'rack'::text,
        'dolly'::text,
        'wheelboard'::text,
        'pallet'::text,
        'crate'::text,
        'other'::text
      ]));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'truck_planner_case_skus_source_kind_check'
  ) then
    alter table public.truck_planner_case_skus
      add constraint truck_planner_case_skus_source_kind_check
      check (source_kind = any (array[
        'manual'::text,
        'sectorpro'::text,
        'manufacturer'::text,
        'truckpacker'::text,
        'flex'::text
      ]));
  end if;
end
$$;

create index if not exists idx_tp_case_skus_external_key
  on public.truck_planner_case_skus(source_external_key)
  where source_external_key is not null;

-- Pull Sheet source -> loaded transport profile mapping.
-- This is deliberately separate from truck_planner_bundle_rules: bundle rules
-- describe Area Tecnica equipment presets, while these rules resolve raw Flex
-- Pull Sheet models. Barcode is the preferred identity; exact source_name is a
-- controlled fallback for models that do not yet have a stable barcode mapping.
create table if not exists public.truck_planner_sound_transport_rules (
  id uuid primary key default gen_random_uuid(),
  source_barcode text,
  source_name text,
  case_sku_id uuid not null references public.truck_planner_case_skus(id) on delete restrict,
  equipment_units_per_transport numeric(10,3) not null,
  source_kind text not null default 'manual',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tp_sound_transport_rules_identity_check
    check (
      nullif(btrim(source_barcode), '') is not null
      or nullif(btrim(source_name), '') is not null
    ),
  constraint tp_sound_transport_rules_units_check
    check (equipment_units_per_transport > 0),
  constraint tp_sound_transport_rules_source_kind_check
    check (source_kind = any (array[
      'manual'::text,
      'sectorpro'::text,
      'manufacturer'::text,
      'truckpacker'::text,
      'flex'::text
    ]))
);

create unique index if not exists idx_tp_sound_transport_rules_barcode
  on public.truck_planner_sound_transport_rules(source_barcode)
  where source_barcode is not null;

create unique index if not exists idx_tp_sound_transport_rules_name
  on public.truck_planner_sound_transport_rules(lower(btrim(source_name)))
  where source_name is not null;

drop trigger if exists set_tp_sound_transport_rules_updated_at
  on public.truck_planner_sound_transport_rules;
create trigger set_tp_sound_transport_rules_updated_at
before update on public.truck_planner_sound_transport_rules
for each row execute function public.set_updated_at();

alter table public.truck_planner_sound_transport_rules enable row level security;

drop policy if exists tp_sound_transport_rules_select
  on public.truck_planner_sound_transport_rules;
create policy tp_sound_transport_rules_select
  on public.truck_planner_sound_transport_rules
  for select using (((select auth.uid()) is not null));

drop policy if exists tp_sound_transport_rules_write
  on public.truck_planner_sound_transport_rules;
create policy tp_sound_transport_rules_write
  on public.truck_planner_sound_transport_rules
  for all using (public.tp_is_office_role())
  with check (public.tp_is_office_role());

-- First verified loaded profile.  Dimensions/weight are the *loaded* cart,
-- not the bare chariot hardware:
-- Truck Packer L-Acoustics library: K2 (4) w/ Chariot = 13.9 x 52.7 x
-- 59.6 in, 542.8 lb.  Rounded here to whole millimetres / 0.1 kg.
insert into public.truck_planner_case_skus (
  sku_id,
  name,
  length_mm,
  width_mm,
  height_mm,
  weight_kg,
  upright_only,
  tilt_allowed,
  allowed_yaw,
  can_be_base,
  top_contact_allowed,
  max_load_above_kg,
  min_support_ratio,
  stack_class,
  is_container,
  transport_kind,
  blocks_vertical_column,
  source_kind,
  source_url,
  source_external_key,
  source_verified_at
) values (
  'lacoustics:k2:4:chariot',
  'L-Acoustics K2 (4) w/ Chariot',
  353,
  1339,
  1514,
  246.2,
  true,
  false,
  array[0, 90, 180, 270],
  false,
  false,
  0,
  1,
  'FLOOR_ONLY,MAX_LEVEL_1',
  true,
  'cart',
  true,
  'truckpacker',
  'https://www.truckpacker.com/manufacturer-library/cases/l-acoustics',
  'truckpacker:l-acoustics:k2-4-chariot',
  now()
)
on conflict (sku_id) do update set
  name = excluded.name,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  weight_kg = excluded.weight_kg,
  upright_only = excluded.upright_only,
  tilt_allowed = excluded.tilt_allowed,
  allowed_yaw = excluded.allowed_yaw,
  can_be_base = excluded.can_be_base,
  top_contact_allowed = excluded.top_contact_allowed,
  max_load_above_kg = excluded.max_load_above_kg,
  min_support_ratio = excluded.min_support_ratio,
  stack_class = excluded.stack_class,
  is_container = excluded.is_container,
  transport_kind = excluded.transport_kind,
  blocks_vertical_column = excluded.blocks_vertical_column,
  source_kind = excluded.source_kind,
  source_url = excluded.source_url,
  source_external_key = excluded.source_external_key,
  source_verified_at = excluded.source_verified_at,
  updated_at = now();

-- Sector-Pro Flex barcode 00160 is the K2 inventory model.  The source Pull
-- Sheet never contains the chariot itself; four K2 normalize to one loaded cart.
insert into public.truck_planner_sound_transport_rules (
  source_barcode,
  source_name,
  case_sku_id,
  equipment_units_per_transport,
  source_kind,
  notes
)
select
  '00160',
  'K2',
  sku.id,
  4,
  'sectorpro',
  '24 K2 on a Sound Pull Sheet normalize to 6 loaded K2 chariots.'
from public.truck_planner_case_skus sku
where sku.sku_id = 'lacoustics:k2:4:chariot'
on conflict (source_barcode) where source_barcode is not null
do update set
  source_name = excluded.source_name,
  case_sku_id = excluded.case_sku_id,
  equipment_units_per_transport = excluded.equipment_units_per_transport,
  source_kind = excluded.source_kind,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

-- Read model used by the Area Tecnica Sound Pull Sheet normalizer.  Keeping the
-- join in SQL means the UI consumes one deterministic rule/profile snapshot and
-- does not have to perform multiple client-side table reads.
create or replace function public.tp_get_sound_transport_rules()
returns table (
  rule_id uuid,
  source_barcode text,
  source_name text,
  equipment_units_per_transport numeric,
  profile_id uuid,
  sku_id text,
  profile_name text,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  weight_kg numeric,
  transport_kind text,
  blocks_vertical_column boolean,
  upright_only boolean,
  tilt_allowed boolean,
  allowed_yaw integer[],
  can_be_base boolean,
  top_contact_allowed boolean,
  max_load_above_kg numeric,
  min_support_ratio numeric,
  stack_class text,
  source_kind text,
  source_url text,
  source_external_key text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    rule.id,
    rule.source_barcode,
    rule.source_name,
    rule.equipment_units_per_transport,
    sku.id,
    sku.sku_id,
    sku.name,
    sku.length_mm,
    sku.width_mm,
    sku.height_mm,
    sku.weight_kg,
    sku.transport_kind,
    sku.blocks_vertical_column,
    sku.upright_only,
    sku.tilt_allowed,
    sku.allowed_yaw,
    sku.can_be_base,
    sku.top_contact_allowed,
    sku.max_load_above_kg,
    sku.min_support_ratio,
    sku.stack_class,
    sku.source_kind,
    sku.source_url,
    sku.source_external_key
  from public.truck_planner_sound_transport_rules rule
  join public.truck_planner_case_skus sku on sku.id = rule.case_sku_id
  where rule.is_active
    and sku.is_active
  order by coalesce(rule.source_barcode, ''), coalesce(rule.source_name, ''), rule.id;
$$;

revoke all on function public.tp_get_sound_transport_rules() from public;
grant execute on function public.tp_get_sound_transport_rules() to authenticated;
