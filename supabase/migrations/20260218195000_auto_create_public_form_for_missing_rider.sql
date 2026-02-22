-- Automatically create a public artist form link when rider_missing is flagged.
create or replace function public.ensure_artist_form_for_missing_rider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.rider_missing, false)
     and (
       tg_op = 'INSERT'
       or coalesce(old.rider_missing, false) is distinct from true
     ) then
    if not exists (
      select 1
      from public.festival_artist_forms f
      where f.artist_id = new.id
        and f.status = 'pending'
        and f.expires_at > timezone('utc', now())
    ) then
      insert into public.festival_artist_forms (
        artist_id,
        status,
        expires_at
      ) values (
        new.id,
        'pending',
        timezone('utc', now()) + interval '7 days'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_artist_form_for_missing_rider on public.festival_artists;

create trigger trg_ensure_artist_form_for_missing_rider
after insert or update of rider_missing on public.festival_artists
for each row
execute function public.ensure_artist_form_for_missing_rider();

