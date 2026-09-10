begin;

select plan(3);

select has_column(
  'public',
  'festival_artists',
  'soundcheck_date',
  'festival artists expose an optional soundcheck date'
);

select col_type_is(
  'public',
  'festival_artists',
  'soundcheck_date',
  'date',
  'soundcheck date uses the date type'
);

insert into public.festival_artists (
  name,
  date,
  soundcheck,
  soundcheck_date,
  soundcheck_start,
  soundcheck_end
) values (
  'Previous-day soundcheck test',
  date '2026-09-10',
  true,
  date '2026-09-09',
  time '18:00',
  time '19:00'
);

select is(
  (
    select soundcheck_date
    from public.festival_artists
    where name = 'Previous-day soundcheck test'
  ),
  date '2026-09-09',
  'a soundcheck can be stored on the previous setup day'
);

select * from finish();

rollback;
