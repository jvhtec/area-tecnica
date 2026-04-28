alter table public.power_requirement_tables
  add column if not exists position text,
  add column if not exists custom_position text,
  add column if not exists table_data jsonb not null default '{"rows":[]}'::jsonb;

alter table public.tour_date_power_overrides
  add column if not exists position text,
  add column if not exists custom_position text;

alter table public.tour_power_defaults
  add column if not exists position text,
  add column if not exists custom_position text;
