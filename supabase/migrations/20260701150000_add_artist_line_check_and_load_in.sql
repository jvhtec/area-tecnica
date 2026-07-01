alter table public.festival_artists
  add column if not exists line_check boolean not null default false,
  add column if not exists line_check_start time without time zone,
  add column if not exists line_check_end time without time zone,
  add column if not exists load_in_time time without time zone;

comment on column public.festival_artists.line_check is
  'Whether the artist requires a line check. Line checks are typically short and happen right before showtime, as opposed to a full soundcheck earlier in the day.';
comment on column public.festival_artists.line_check_start is
  'Line check start time.';
comment on column public.festival_artists.line_check_end is
  'Line check end time.';
comment on column public.festival_artists.load_in_time is
  'Artist/crew load-in time.';
