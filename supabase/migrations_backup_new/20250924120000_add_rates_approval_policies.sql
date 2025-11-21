-- Enable RLS (no-op if already enabled)
alter table if exists public.tours enable row level security;
alter table if exists public.jobs enable row level security;

-- Policy: management can update rates approval on tours
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tours' and policyname='management_update_tour_rates_approval'
  ) then
    create policy management_update_tour_rates_approval on public.tours
      for update
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','management')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','management')));
  end if;
end $$;

-- Policy: management can update rates approval on jobs
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='jobs' and policyname='management_update_job_rates_approval'
  ) then
    create policy management_update_job_rates_approval on public.jobs
      for update
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','management')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','management')));
  end if;
end $$;

