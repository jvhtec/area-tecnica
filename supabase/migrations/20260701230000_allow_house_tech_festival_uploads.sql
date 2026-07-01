insert into storage.buckets (id, name, public)
values
  ('festival_artist_files', 'festival_artist_files', false),
  ('festival-logos', 'festival-logos', false)
on conflict (id) do nothing;

drop policy if exists "p_festival_artist_files_public_insert_279f74" on public.festival_artist_files;

create policy "p_festival_artist_files_public_insert_279f74"
on public.festival_artist_files
for insert
to authenticated
with check (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

drop policy if exists "p_festival_logos_public_insert_4ce816" on public.festival_logos;
drop policy if exists "p_festival_logos_public_update_bc2a4a" on public.festival_logos;

create policy "p_festival_logos_public_insert_4ce816"
on public.festival_logos
for insert
to authenticated
with check (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

create policy "p_festival_logos_public_update_bc2a4a"
on public.festival_logos
for update
to authenticated
using (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
)
with check (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

drop policy if exists "p_storage_festival_artist_files_house_tech_select" on storage.objects;
drop policy if exists "p_storage_festival_artist_files_house_tech_insert" on storage.objects;
drop policy if exists "p_storage_festival_artist_files_house_tech_update" on storage.objects;
drop policy if exists "p_storage_festival_artist_files_authorized_select" on storage.objects;
drop policy if exists "p_storage_festival_artist_files_authorized_insert" on storage.objects;
drop policy if exists "p_storage_festival_artist_files_authorized_update" on storage.objects;
drop policy if exists "p_storage_festival_logos_house_tech_select" on storage.objects;
drop policy if exists "p_storage_festival_logos_house_tech_insert" on storage.objects;
drop policy if exists "p_storage_festival_logos_house_tech_update" on storage.objects;
drop policy if exists "p_storage_festival_logos_authorized_select" on storage.objects;
drop policy if exists "p_storage_festival_logos_authorized_insert" on storage.objects;
drop policy if exists "p_storage_festival_logos_authorized_update" on storage.objects;

create policy "p_storage_festival_artist_files_authorized_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'festival_artist_files'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.festival_artists fa
    where fa.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);

create policy "p_storage_festival_artist_files_authorized_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'festival_artist_files'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.festival_artists fa
    where fa.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);

create policy "p_storage_festival_artist_files_authorized_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'festival_artist_files'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.festival_artists fa
    where fa.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
)
with check (
  bucket_id = 'festival_artist_files'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.festival_artists fa
    where fa.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);

create policy "p_storage_festival_logos_authorized_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'festival-logos'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
        then split_part(storage.objects.name, '.', 1)::uuid
      else null
    end
      and j.job_type::text in ('festival', 'ciclo')
  )
);

create policy "p_storage_festival_logos_authorized_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'festival-logos'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
        then split_part(storage.objects.name, '.', 1)::uuid
      else null
    end
      and j.job_type::text in ('festival', 'ciclo')
  )
);

create policy "p_storage_festival_logos_authorized_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'festival-logos'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
        then split_part(storage.objects.name, '.', 1)::uuid
      else null
    end
      and j.job_type::text in ('festival', 'ciclo')
  )
)
with check (
  bucket_id = 'festival-logos'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
        then split_part(storage.objects.name, '.', 1)::uuid
      else null
    end
      and j.job_type::text in ('festival', 'ciclo')
  )
);
