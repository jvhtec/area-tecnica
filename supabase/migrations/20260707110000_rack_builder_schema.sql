-- Rack Builder: schema for rack/panel layout design tool (sound department).
-- Consolidated from the standalone jvhtec/rack-builder project's 20 migrations,
-- reflecting final-state columns/constraints (legacy exclusion constraints from
-- that project's migration 013 are intentionally omitted; the
-- rack_builder_validate_layout_item_semantics trigger, added below in the
-- companion functions migration, is the sole source of truth for slot/depth
-- collision rules).

create type rack_builder_rack_width as enum ('single', 'dual');
create type rack_builder_device_facing as enum ('front', 'rear');
create type rack_builder_drawing_state as enum ('preliminary', 'rev', 'as_built');

create table rack_builder_racks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rack_units integer not null check (rack_units > 0),
  depth_mm integer not null,
  width rack_builder_rack_width not null default 'single',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rack_builder_device_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rack_builder_device_categories_name_lower_idx
  on rack_builder_device_categories (lower(name));

insert into rack_builder_device_categories (name) values ('Uncategorized');

create table rack_builder_devices (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  rack_units integer not null check (rack_units > 0),
  depth_mm integer not null,
  front_image_path text,
  rear_image_path text,
  category_id uuid not null references rack_builder_device_categories(id) on delete restrict,
  weight_kg numeric(10,2) not null default 0 check (weight_kg >= 0),
  power_w integer not null default 0 check (power_w >= 0),
  is_half_rack boolean not null default false,
  fav boolean not null default false,
  invert_image_in_dark_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rack_builder_devices_category_id_idx on rack_builder_devices(category_id);

create table rack_builder_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner text,
  drawing_state rack_builder_drawing_state not null default 'preliminary',
  revision_number integer not null default 0 check (revision_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rack_builder_layouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rack_builder_projects(id) on delete cascade,
  rack_id uuid not null references rack_builder_racks(id) on delete cascade,
  name text not null,
  drawing_state rack_builder_drawing_state not null default 'preliminary',
  revision_number integer not null default 0 check (revision_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rack_builder_layouts_project_id_idx on rack_builder_layouts(project_id);
create index rack_builder_layouts_rack_id_idx on rack_builder_layouts(rack_id);

create table rack_builder_connectors (
  id text primary key,
  name text not null,
  category text not null check (category in ('audio', 'data', 'power', 'multipin', 'other')),
  image_path text not null,
  grid_width integer not null check (grid_width > 0),
  grid_height integer not null check (grid_height > 0),
  mounting text not null check (mounting in ('front', 'rear', 'both')),
  notes text not null default '',
  weight_kg double precision not null default 0 check (weight_kg >= 0),
  is_d_size boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rack_builder_connectors_category_idx on rack_builder_connectors(category);
create index rack_builder_connectors_name_idx on rack_builder_connectors(name);

create table rack_builder_panel_layouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rack_builder_projects(id) on delete cascade,
  name text not null,
  height_ru integer not null check (height_ru between 1 and 6),
  depth_mm integer not null default 80 check (depth_mm > 0),
  facing rack_builder_device_facing not null default 'front',
  has_lacing_bar boolean not null default false,
  notes text,
  weight_kg numeric(10,2) not null default 0 check (weight_kg >= 0),
  drawing_state rack_builder_drawing_state not null default 'preliminary',
  revision_number integer not null default 0 check (revision_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rack_builder_panel_layouts_project_id_idx on rack_builder_panel_layouts(project_id);

create table rack_builder_panel_layout_rows (
  id uuid primary key default gen_random_uuid(),
  panel_layout_id uuid not null references rack_builder_panel_layouts(id) on delete cascade,
  row_index integer not null check (row_index >= 0),
  hole_count integer not null check (hole_count in (4, 6, 8, 12, 16)),
  active_column_map jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rack_builder_panel_layout_rows_panel_row_unique unique (panel_layout_id, row_index)
);

create index rack_builder_panel_layout_rows_panel_layout_id_idx
  on rack_builder_panel_layout_rows(panel_layout_id);

create table rack_builder_panel_layout_ports (
  id uuid primary key default gen_random_uuid(),
  panel_layout_id uuid not null,
  connector_id text not null,
  row_index integer not null check (row_index >= 0),
  hole_index integer not null check (hole_index >= 0),
  span_w integer not null default 1 check (span_w > 0),
  span_h integer not null default 1 check (span_h > 0),
  label text,
  color text check (color is null or color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rack_builder_panel_layout_ports_row_fk
    foreign key (panel_layout_id, row_index)
    references rack_builder_panel_layout_rows(panel_layout_id, row_index)
    on delete cascade
);

create index rack_builder_panel_layout_ports_panel_layout_id_idx
  on rack_builder_panel_layout_ports(panel_layout_id);

create extension if not exists btree_gist;

-- Ranges (not row_index equality) so a port with span_h > 1 is checked for
-- overlap against every row it visually spans, not just its starting row.
alter table rack_builder_panel_layout_ports
  add constraint rack_builder_panel_layout_ports_no_overlap_excl
  exclude using gist (
    panel_layout_id with =,
    int4range(row_index, row_index + span_h) with &&,
    int4range(hole_index, hole_index + span_w) with &&
  );

create table rack_builder_layout_items (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references rack_builder_layouts(id) on delete cascade,
  device_id uuid references rack_builder_devices(id) on delete cascade,
  panel_layout_id uuid references rack_builder_panel_layouts(id) on delete restrict,
  start_u integer not null,
  facing rack_builder_device_facing not null default 'front',
  preferred_lane integer check (preferred_lane in (0, 1)),
  preferred_sub_lane integer check (preferred_sub_lane in (0, 1)),
  force_full_width boolean not null default false,
  rack_ear_offset_mm numeric not null default 0 check (rack_ear_offset_mm >= 0),
  custom_name text,
  notes text,
  constraint rack_builder_layout_items_asset_reference_check check (
    (device_id is not null and panel_layout_id is null)
    or (device_id is null and panel_layout_id is not null)
  )
);

create index rack_builder_layout_items_layout_id_idx on rack_builder_layout_items(layout_id);
create index rack_builder_layout_items_device_id_idx on rack_builder_layout_items(device_id);
create index rack_builder_layout_items_panel_layout_id_idx on rack_builder_layout_items(panel_layout_id);

-- Reuse the app-wide updated_at trigger function already defined for other tables.
create trigger rack_builder_racks_set_updated_at
  before update on rack_builder_racks
  for each row execute function public.update_updated_at_column();

create trigger rack_builder_device_categories_set_updated_at
  before update on rack_builder_device_categories
  for each row execute function public.update_updated_at_column();

create trigger rack_builder_devices_set_updated_at
  before update on rack_builder_devices
  for each row execute function public.update_updated_at_column();

create trigger rack_builder_connectors_set_updated_at
  before update on rack_builder_connectors
  for each row execute function public.update_updated_at_column();

create trigger rack_builder_panel_layout_rows_set_updated_at
  before update on rack_builder_panel_layout_rows
  for each row execute function public.update_updated_at_column();

create trigger rack_builder_panel_layout_ports_set_updated_at
  before update on rack_builder_panel_layout_ports
  for each row execute function public.update_updated_at_column();

-- projects/layouts/panel_layouts use their own drawing-revision trigger instead
-- (defined in the companion functions migration), not the plain updated_at one.

insert into rack_builder_connectors (
  id, name, category, image_path, grid_width, grid_height, mounting, notes, weight_kg, is_d_size
)
values
  ('xlr_d_series', 'XLR (D-Series)', 'audio', '/connectors/d-series.svg', 1, 1, 'both', 'Unified 24 mm D-size cut-out.', 0.07, true),
  ('ethercon_rj45', 'RJ45 / etherCON', 'data', '/connectors/rj45.svg', 1, 1, 'both', 'D-size shell with RJ45 insert.', 0.06, true),
  ('powercon_true1', 'powerCON TRUE1', 'power', '/connectors/powercon.svg', 1, 2, 'front', 'Locking release tab, front mounting only.', 0.12, false),
  ('speakon_d', 'speakON (D-Series)', 'audio', '/connectors/d-series.svg', 1, 1, 'both', 'Speaker connector in D-size format.', 0.08, true),
  ('bnc_d', 'BNC (D-Series)', 'data', '/connectors/d-series.svg', 1, 1, 'both', 'Coax connector in D-size format.', 0.05, true),
  ('soca_lk37', 'Socapex / LK37', 'multipin', '/connectors/socapex.svg', 2, 2, 'front', 'Approx. 46 mm mounting hole.', 0.35, false),
  ('cee_16a', 'CEE 16A', 'power', '/connectors/cee.svg', 2, 3, 'front', 'Industrial power connector.', 0.42, false),
  ('blank_insert', 'Blank Insert', 'other', '/connectors/blank.svg', 1, 1, 'both', 'Filler for unused holes.', 0.02, false);
