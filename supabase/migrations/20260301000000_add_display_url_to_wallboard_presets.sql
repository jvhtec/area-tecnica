-- Add display_url to wallboard_presets for per-preset wallboard links
alter table public.wallboard_presets
  add column if not exists display_url text not null default '';

update public.wallboard_presets
set display_url = coalesce(nullif(display_url, ''), '/wallboard/' || slug);

alter table public.wallboard_presets
  add constraint wallboard_presets_display_url_unique unique (display_url);
