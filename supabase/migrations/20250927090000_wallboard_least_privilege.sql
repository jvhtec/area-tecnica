-- Use existing helper get_current_user_role() present in this project

-- Ensure RLS is enabled on core tables (no-op if already enabled)
alter table if exists public.jobs enable row level security;
alter table if exists public.job_assignments enable row level security;
alter table if exists public.announcements enable row level security;
alter table if exists public.required_docs enable row level security;

-- Read-only select policies for wallboard, management, admin
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='jobs' and policyname='wb_jobs_select'
  ) then
    create policy wb_jobs_select on public.jobs
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_assignments' and policyname='wb_assign_select'
  ) then
    create policy wb_assign_select on public.job_assignments
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='announcements' and policyname='wb_ann_select'
  ) then
    create policy wb_ann_select on public.announcements
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='required_docs' and policyname='wb_reqdocs_select'
  ) then
    create policy wb_reqdocs_select on public.required_docs
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

-- Profiles safe view (names only) for wallboard lookups
create or replace view public.wallboard_profiles as
select id, first_name, last_name, department
from public.profiles;

alter view public.wallboard_profiles owner to postgres;
grant select on public.wallboard_profiles to authenticated;

-- Timesheet status aggregated view (no amounts)
create or replace view public.wallboard_timesheet_status as
select
  t.job_id,
  t.technician_id,
  case
    when bool_or(t.status = 'approved') then 'approved'
    when bool_or(t.status = 'submitted') then 'submitted'
    when bool_or(t.status = 'draft') then 'draft'
    else 'missing'
  end as status
from public.timesheets t
group by t.job_id, t.technician_id;

alter view public.wallboard_timesheet_status owner to postgres;
grant select on public.wallboard_timesheet_status to authenticated;

-- Document counts per job+dept
create or replace view public.wallboard_doc_counts as
select
  jd.job_id,
  case
    when split_part(jd.file_path, '/', 1) in ('sound','lights','video') then split_part(jd.file_path, '/', 1)
    else 'unknown'
  end as department,
  count(*)::int as have
from public.job_documents jd
group by jd.job_id,
  case
    when split_part(jd.file_path, '/', 1) in ('sound','lights','video') then split_part(jd.file_path, '/', 1)
    else 'unknown'
  end;

alter view public.wallboard_doc_counts owner to postgres;
grant select on public.wallboard_doc_counts to authenticated;

-- Required doc totals per department
create or replace view public.wallboard_doc_requirements as
select department, count(*)::int as need
from public.required_docs
where is_required
group by department;

alter view public.wallboard_doc_requirements owner to postgres;
grant select on public.wallboard_doc_requirements to authenticated;
