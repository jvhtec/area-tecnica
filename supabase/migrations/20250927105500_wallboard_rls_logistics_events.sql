-- Enable wallboard read for logistics events and related tables

alter table if exists public.logistics_events enable row level security;
alter table if exists public.logistics_event_departments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='logistics_events' and policyname='wb_logistics_events_select'
  ) then
    create policy wb_logistics_events_select on public.logistics_events
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='logistics_event_departments' and policyname='wb_logistics_event_depts_select'
  ) then
    create policy wb_logistics_event_depts_select on public.logistics_event_departments
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

