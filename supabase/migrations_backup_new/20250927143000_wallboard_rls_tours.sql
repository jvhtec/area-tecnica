-- Allow wallboard/admin/management to read tours for filtering cancelled tours on wallboard

alter table if exists public.tours enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tours' and policyname='wb_tours_select'
  ) then
    create policy wb_tours_select on public.tours
    for select to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text,'wallboard'::text]));
  end if;
end $$;

