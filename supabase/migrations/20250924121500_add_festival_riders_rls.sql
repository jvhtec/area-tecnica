-- Enable RLS on festival_artist_files and festival_artists
alter table if exists public.festival_artist_files enable row level security;
alter table if exists public.festival_artists enable row level security;

-- SELECT policies for festival_artist_files
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='festival_artist_files' and policyname='festival_riders_select_management'
  ) then
    create policy festival_riders_select_management on public.festival_artist_files
      for select
      using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','management'))
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='festival_artist_files' and policyname='festival_riders_select_job_participants'
  ) then
    create policy festival_riders_select_job_participants on public.festival_artist_files
      for select
      using (
        exists (
          select 1
          from public.festival_artists fa
          join public.job_assignments ja on ja.job_id = fa.job_id
          where fa.id = festival_artist_files.artist_id
            and ja.technician_id = auth.uid()
        )
      );
  end if;
end $$;

-- SELECT policies for festival_artists (required for joins)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='festival_artists' and policyname='festival_artists_select_management'
  ) then
    create policy festival_artists_select_management on public.festival_artists
      for select
      using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','management'))
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='festival_artists' and policyname='festival_artists_select_job_participants'
  ) then
    create policy festival_artists_select_job_participants on public.festival_artists
      for select
      using (
        exists (
          select 1 from public.job_assignments ja
          where ja.job_id = festival_artists.job_id and ja.technician_id = auth.uid()
        )
      );
  end if;
end $$;

