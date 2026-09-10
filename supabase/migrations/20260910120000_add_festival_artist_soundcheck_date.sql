-- A soundcheck normally happens on the artist's show date, but some festivals
-- schedule it on an earlier setup day. NULL preserves the legacy same-day
-- behaviour while allowing an explicit calendar date when the schedule differs.

alter table public.festival_artists
  add column if not exists soundcheck_date date;

comment on column public.festival_artists.soundcheck_date is
  'Optional calendar date for the soundcheck. NULL means the artist show date.';
