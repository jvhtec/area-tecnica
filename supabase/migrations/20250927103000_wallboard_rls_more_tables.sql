-- Extend least-privilege read access for wallboard role to supporting tables

-- Ensure RLS is enabled (no-op if already on)
alter table if exists public.job_departments enable row level security;
alter table if exists public.locations enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.job_documents enable row level security;
alter table if exists public.timesheets enable row level security;

-- job_departments: allow select for admin/management/wallboard
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_departments' and policyname='wb_job_departments_select'
  ) then
    create policy wb_job_departments_select on public.job_departments
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

-- locations: allow select for admin/management/wallboard
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='locations' and policyname='wb_locations_select'
  ) then
    create policy wb_locations_select on public.locations
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

-- profiles: allow read of basic identity for wallboard as well
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='wb_profiles_select'
  ) then
    create policy wb_profiles_select on public.profiles
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

-- job_documents: allow select for counts across departments
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_documents' and policyname='wb_job_documents_select'
  ) then
    create policy wb_job_documents_select on public.job_documents
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

-- timesheets: allow select so the aggregated status view can read rows
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='timesheets' and policyname='wb_timesheets_select'
  ) then
    create policy wb_timesheets_select on public.timesheets
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

