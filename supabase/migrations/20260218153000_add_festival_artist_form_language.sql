alter table public.festival_artists
  add column if not exists form_language text;

update public.festival_artists
set form_language = 'es'
where form_language is null or btrim(form_language) = '';

alter table public.festival_artists
  alter column form_language set default 'es';

alter table public.festival_artists
  drop constraint if exists festival_artists_form_language_check;

alter table public.festival_artists
  add constraint festival_artists_form_language_check
  check (form_language in ('es', 'en'));

alter table public.festival_artists
  alter column form_language set not null;
