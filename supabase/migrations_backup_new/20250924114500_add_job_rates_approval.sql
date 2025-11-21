-- Add per-job rates approval fields (for non-tour jobs)
alter table public.jobs
  add column if not exists rates_approved boolean not null default false,
  add column if not exists rates_approved_at timestamptz null,
  add column if not exists rates_approved_by uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_rates_approved_by_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_rates_approved_by_fkey
      foreign key (rates_approved_by)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

comment on column public.jobs.rates_approved is 'When true, technicians can see payouts for this job.';
comment on column public.jobs.rates_approved_at is 'Timestamp when management approved rates for this job.';
comment on column public.jobs.rates_approved_by is 'Profile ID of the approver.';

