-- Add a visibility flag on job documents to control technician access
-- and tighten RLS so technicians only see documents explicitly marked visible.

-- 1) Schema change: add column with sane default
alter table if exists public.job_documents
  add column if not exists visible_to_tech boolean not null default false;

-- 2) RLS: adjust read policies so that
--    - management/logistics can view all job documents
--    - technicians only see documents for their assigned jobs that are flagged visible

do $$ begin
  -- Drop old broad view policy if present
  if exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='job_documents' and policyname='Users can view documents for their assigned jobs'
  ) then
    drop policy "Users can view documents for their assigned jobs" on public.job_documents;
  end if;

  -- Management/logistics full access
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='job_documents' and policyname='mgmt_can_view_all_job_documents'
  ) then
    create policy mgmt_can_view_all_job_documents on public.job_documents
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'logistics'::text]));
  end if;

  -- Technicians: only visible docs for their assigned jobs
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='job_documents' and policyname='techs_can_view_visible_docs_for_assigned_jobs'
  ) then
    create policy techs_can_view_visible_docs_for_assigned_jobs on public.job_documents
    for select to authenticated
    using (
      visible_to_tech = true and job_id in (
        select ja.job_id from public.job_assignments ja where ja.technician_id = auth.uid()
      )
    );
  end if;

  -- Allow management to update visibility and other metadata
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='job_documents' and policyname='mgmt_can_update_job_documents'
  ) then
    create policy mgmt_can_update_job_documents on public.job_documents
    for update to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text]))
    with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));
  end if;
end $$;

