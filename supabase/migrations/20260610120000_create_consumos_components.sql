-- Consumos component catalog: moves the hardcoded component databases of the
-- three Consumos tools (sound / lights / video) to the backend so users can
-- add new items (name, watts, fixture type / PF) without a code change.
--
-- legacy_code preserves the numeric ids the frontend previously hardcoded so
-- componentId references stored in power_requirement_tables.table_data,
-- tour_default_tables.table_data and tour_date_power_overrides.override_data
-- keep resolving after the switch.

create table if not exists public.consumos_components (
  id uuid primary key default gen_random_uuid(),
  department public.department not null,
  name text not null,
  watts numeric not null check (watts > 0),
  fixture_type text check (fixture_type in ('incandescent', 'discharge', 'led', 'led-pro', 'smoke', 'consoles')),
  legacy_code integer,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null default auth.uid()
);

comment on table public.consumos_components is 'Component catalog for the Consumos (power calculator) tools, per department. Seeded from the previously hardcoded frontend databases; users can add new entries.';
comment on column public.consumos_components.fixture_type is 'Lights only: fixture category used to recommend a power factor.';
comment on column public.consumos_components.legacy_code is 'Numeric id the frontend used before the catalog moved to the database; kept so saved table rows keep resolving.';

create unique index if not exists consumos_components_department_name_key
  on public.consumos_components (department, lower(name));

create unique index if not exists consumos_components_department_legacy_code_key
  on public.consumos_components (department, legacy_code)
  where legacy_code is not null;

alter table public.consumos_components enable row level security;

drop policy if exists "consumos_components_select_authenticated" on public.consumos_components;
create policy "consumos_components_select_authenticated"
on public.consumos_components
for select
to authenticated
using (true);

drop policy if exists "consumos_components_insert_authenticated" on public.consumos_components;
create policy "consumos_components_insert_authenticated"
on public.consumos_components
for insert
to authenticated
with check (true);

drop policy if exists "consumos_components_update_management" on public.consumos_components;
create policy "consumos_components_update_management"
on public.consumos_components
for update
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]))
with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

drop policy if exists "consumos_components_delete_management" on public.consumos_components;
create policy "consumos_components_delete_management"
on public.consumos_components
for delete
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

drop trigger if exists set_consumos_components_updated_at on public.consumos_components;
create trigger set_consumos_components_updated_at
before update on public.consumos_components
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on table public.consumos_components to authenticated;
grant all on table public.consumos_components to service_role;

-- Seed: sound
insert into public.consumos_components (department, name, watts, legacy_code) values
  ('sound', 'LA12X', 2000, 1),
  ('sound', 'LA8', 1500, 2),
  ('sound', 'LA4X', 750, 3),
  ('sound', 'PLM20000D', 2900, 4),
  ('sound', 'Control FoH (L)', 3500, 5),
  ('sound', 'Control FoH (S)', 1500, 6),
  ('sound', 'Control Mon (L)', 3500, 7),
  ('sound', 'Control Mon (S)', 1500, 8),
  ('sound', 'RF Rack', 2500, 9),
  ('sound', 'Backline', 2500, 10),
  ('sound', 'Varios', 1500, 11)
on conflict (department, lower(name)) do nothing;

-- Seed: video
insert into public.consumos_components (department, name, watts, legacy_code) values
  ('video', 'Pantalla Central', 700, 1),
  ('video', 'IMAGE Left', 700, 2),
  ('video', 'IMAGE Right', 700, 3),
  ('video', 'LED Screen', 700, 4)
on conflict (department, lower(name)) do nothing;

-- Seed: lights
insert into public.consumos_components (department, name, watts, fixture_type, legacy_code) values
  ('lights', 'CAMEO OPUS S5', 650, 'led', 1),
  ('lights', 'CLAY PAKY A-LEDA K20', 650, 'led', 2),
  ('lights', 'CLAY PAKY A-LEDA K25', 1100, 'led', 3),
  ('lights', 'CLAY PAKY STORMY CC', 800, 'discharge', 4),
  ('lights', 'ELATION CHORUS LINE 16', 750, 'led', 5),
  ('lights', 'MARTIN MAC AURA', 260, 'led', 6),
  ('lights', 'MARTIN MAC VIPER', 1200, 'discharge', 7),
  ('lights', 'ROBE BMFL BLADE', 2000, 'discharge', 8),
  ('lights', 'ROBE BMFL SPOT', 2000, 'discharge', 9),
  ('lights', 'ROBE BMFL WASHBEAM', 2000, 'discharge', 10),
  ('lights', 'ROBE MEGAPOINTE', 670, 'discharge', 11),
  ('lights', 'ROBE POINTE', 470, 'discharge', 12),
  ('lights', 'TRITON BLUE 15R BEAM', 500, 'discharge', 13),
  ('lights', 'TRITON BLUE 15R SPOT', 500, 'discharge', 14),
  ('lights', 'TRITON BLUE WALLY 3715', 650, 'discharge', 15),
  ('lights', 'CAMEO AURO BAR 100', 140, 'led', 16),
  ('lights', 'ACL 250W (2 BARRAS)', 2000, 'incandescent', 17),
  ('lights', 'ACL 650W (2 BARRAS)', 5200, 'incandescent', 18),
  ('lights', 'BARRA PAR 64x6', 6000, 'incandescent', 19),
  ('lights', 'FRESNELL 2KW', 2000, 'incandescent', 20),
  ('lights', 'MOLEFAY BLINDER 4', 2600, 'incandescent', 21),
  ('lights', 'MOLEFAY BLINDER 8', 5200, 'incandescent', 22),
  ('lights', 'PAR 64', 1000, 'incandescent', 23),
  ('lights', 'ADMIRAL VINTAGE 53cm', 60, 'incandescent', 24),
  ('lights', 'ADMIRAL VINTAGE 38cm', 60, 'incandescent', 25),
  ('lights', 'FRESNELL 5KW', 5000, 'incandescent', 26),
  ('lights', 'MOLEFAY BLINDER 2', 1300, 'incandescent', 27),
  ('lights', 'RECORTE ETC 25º/50º', 750, 'incandescent', 28),
  ('lights', 'RECORTE ETC 15º/30º', 750, 'incandescent', 29),
  ('lights', 'RECORTE ETC 19º', 750, 'incandescent', 30),
  ('lights', 'RECORTE ETC 10º', 750, 'incandescent', 31),
  ('lights', 'RECORTE TB LED 25º/50º', 300, 'led', 32),
  ('lights', 'SUNSTRIP', 500, 'incandescent', 33),
  ('lights', 'CAMEO ZENIT 120', 120, 'led', 34),
  ('lights', 'ELATION SIXBAR 1000', 150, 'led', 35),
  ('lights', 'MARTIN ATOMIC 3000', 3000, 'discharge', 36),
  ('lights', 'SGM Q7', 500, 'led', 37),
  ('lights', 'ELATION SIXBAR 500', 80, 'led', 38),
  ('lights', 'SMOKE FACTORY TOUR HAZER II', 1500, 'smoke', 39),
  ('lights', 'ROBE 500 FT-PRO', 1200, 'smoke', 40),
  ('lights', 'SAHARA TURBO DRYER', 1500, 'smoke', 41),
  ('lights', 'ROBE SPIIDER', 660, 'led', 42),
  ('lights', 'GLP JDC1', 1200, 'led', 43),
  ('lights', 'CAMEO W3', 325, 'led', 44),
  ('lights', 'CHAUVET COLOR STRIKE M', 750, 'led', 45),
  ('lights', 'GLP X4 BAR 20', 500, 'led', 46),
  ('lights', 'ROBERT JULIAT ARAMIS', 2500, 'discharge', 47),
  ('lights', 'ROBERT JULIAT MERLIN', 2500, 'discharge', 48),
  ('lights', 'ROBERT JULIAT CYRANO', 2500, 'discharge', 49),
  ('lights', 'ROBERT JULIAT LANCELOT', 4000, 'discharge', 50),
  ('lights', 'ROBERT JULIAT KORRIGAN', 1200, 'discharge', 51),
  ('lights', 'PIXEL LINE IP', 420, 'led', 52),
  ('lights', 'COLORADO PXL BAR', 768, 'led', 53),
  ('lights', 'AROLLA AQUA S-LT', 600, 'led', 54),
  ('lights', 'AROLLA AQUA HP', 1900, 'led', 55),
  ('lights', 'HY B-EYE K15 AQUA', 680, 'led', 56),
  ('lights', 'CLUSTER B2 FC', 600, 'led', 57),
  ('lights', 'ACME TORNADO', 935, 'led', 58),
  ('lights', 'CLAY PAKY A-LEDA K15', 760, 'led', 59),
  ('lights', 'AROLLA AQUA LT', 1400, 'led', 60),
  ('lights', 'CUARZO', 400, 'incandescent', 61),
  ('lights', 'MINI-B AQUA PX', 375, 'led', 62),
  ('lights', 'FREE PAR PRO 72', 80, 'led', 63),
  ('lights', 'FRESNEL 1 kW', 1000, 'incandescent', 64),
  ('lights', 'FRESNEL 300 W', 300, 'incandescent', 65),
  ('lights', 'ANTARI HZ 500', 480, 'smoke', 66),
  ('lights', 'TURBINA SHOWTEC SF-250', 1035, 'smoke', 67),
  ('lights', 'BRITEQ HZFOG II', 1750, 'smoke', 68),
  ('lights', 'GRAND MA3 FULL SIZE', 450, 'consoles', 70),
  ('lights', 'ULTIMO HYBRID', 550, 'discharge', 71)
on conflict (department, lower(name)) do nothing;
