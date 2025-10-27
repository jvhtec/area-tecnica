-- Create wallboard_presets table for configurable panel sequencing
create table if not exists public.wallboard_presets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  panel_order text[] not null check (array_length(panel_order, 1) > 0),
  panel_durations jsonb not null,
  rotation_fallback_seconds integer not null default 12,
  highlight_ttl_seconds integer not null default 300,
  ticker_poll_interval_seconds integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure updated_at stays in sync
drop trigger if exists wallboard_presets_set_updated_at on public.wallboard_presets;
create trigger wallboard_presets_set_updated_at
  before update on public.wallboard_presets
  for each row execute function public.set_updated_at();

-- Enable RLS and add policies for wallboard usage
alter table public.wallboard_presets enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallboard_presets' and policyname = 'wb_presets_select'
  ) then
    create policy wb_presets_select on public.wallboard_presets
      for select to authenticated
      using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallboard_presets' and policyname = 'wb_presets_admin_write'
  ) then
    create policy wb_presets_admin_write on public.wallboard_presets
      for all to authenticated
      using (public.get_current_user_role() = any (array['admin'::text,'management'::text]))
      with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));
  end if;
end $$;

-- Seed default preset mirroring legacy behaviour
insert into public.wallboard_presets (slug, name, description, panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds)
values (
  'default',
  'Default Rotation',
  'Matches the historical wallboard rotation order and timing.',
  array['overview','crew','docs','logistics','pending'],
  jsonb_build_object(
    'overview', 12,
    'crew', 12,
    'docs', 12,
    'logistics', 12,
    'pending', 12
  ),
  12,
  300,
  20
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  panel_order = excluded.panel_order,
  panel_durations = excluded.panel_durations,
  rotation_fallback_seconds = excluded.rotation_fallback_seconds,
  highlight_ttl_seconds = excluded.highlight_ttl_seconds,
  ticker_poll_interval_seconds = excluded.ticker_poll_interval_seconds;
