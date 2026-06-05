create table if not exists public.job_project_notes (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  notes text not null default '',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid()
);

comment on table public.job_project_notes is 'Internal project notes for jobs, visible and editable only by admin and management users.';
comment on column public.job_project_notes.notes is 'Free-text production/project notes for the job.';

alter table public.job_project_notes enable row level security;

drop policy if exists "job_project_notes_select_management" on public.job_project_notes;
create policy "job_project_notes_select_management"
on public.job_project_notes
for select
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

drop policy if exists "job_project_notes_insert_management" on public.job_project_notes;
create policy "job_project_notes_insert_management"
on public.job_project_notes
for insert
to authenticated
with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

drop policy if exists "job_project_notes_update_management" on public.job_project_notes;
create policy "job_project_notes_update_management"
on public.job_project_notes
for update
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]))
with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

drop policy if exists "job_project_notes_delete_management" on public.job_project_notes;
create policy "job_project_notes_delete_management"
on public.job_project_notes
for delete
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

drop trigger if exists set_job_project_notes_updated_at on public.job_project_notes;
create trigger set_job_project_notes_updated_at
before update on public.job_project_notes
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on table public.job_project_notes to authenticated;
grant all on table public.job_project_notes to service_role;
