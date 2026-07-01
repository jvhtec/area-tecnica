-- House techs use the festival management "Subir Documentos" quick action,
-- which writes job-scoped objects (<job uuid>/<file name>) to the
-- job-documents bucket and then self-attributes the job_documents metadata
-- row. Codify storage policies for that bucket so every authorized
-- festival-management role (including house_tech) can upload, read, update,
-- and remove those objects, mirroring 20260701230000_allow_house_tech_festival_uploads.sql.

insert into storage.buckets (id, name, public)
values ('job-documents', 'job-documents', false)
on conflict (id) do nothing;

drop policy if exists "p_storage_job_documents_authorized_select" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_insert" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_update" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_delete" on storage.objects;

create policy "p_storage_job_documents_authorized_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-documents'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);

create policy "p_storage_job_documents_authorized_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-documents'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);

create policy "p_storage_job_documents_authorized_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'job-documents'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
)
with check (
  bucket_id = 'job-documents'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);

create policy "p_storage_job_documents_authorized_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'job-documents'
  and public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  and exists (
    select 1
    from public.jobs j
    where j.id = case
      when split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then split_part(storage.objects.name, '/', 1)::uuid
      else null
    end
  )
);
