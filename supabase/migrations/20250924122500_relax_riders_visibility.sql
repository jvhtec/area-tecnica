-- Broaden visibility for artist riders and related artist rows
alter table if exists public.festival_artist_files enable row level security;
alter table if exists public.festival_artists enable row level security;

do $$
begin
  -- Allow all users to select rider rows (broad visibility)
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='festival_artist_files' and policyname='festival_riders_select_all'
  ) then
    create policy festival_riders_select_all on public.festival_artist_files
      for select using (true);
  end if;

  -- Allow all users to select artist rows needed for joins
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='festival_artists' and policyname='festival_artists_select_all'
  ) then
    create policy festival_artists_select_all on public.festival_artists
      for select using (true);
  end if;
end $$;

-- Ensure storage read is permitted for the riders bucket via RLS on storage.objects
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders_bucket_read_all'
  ) then
    create policy riders_bucket_read_all on storage.objects
      for select 
      using (bucket_id = 'festival_artist_files');
  end if;
end $$;

