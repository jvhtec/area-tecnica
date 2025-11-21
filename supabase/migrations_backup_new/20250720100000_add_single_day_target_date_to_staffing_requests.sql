-- Add per-date scoping to staffing_requests so UI can show single-day requests per date
alter table public.staffing_requests
  add column if not exists single_day boolean not null default false,
  add column if not exists target_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staffing_requests_single_day_check'
      and conrelid = 'public.staffing_requests'::regclass
  ) then
    alter table public.staffing_requests
      add constraint staffing_requests_single_day_check
      check (single_day = false or target_date is not null);
  end if;
end $$;

create index if not exists staffing_requests_target_date_idx
  on public.staffing_requests (target_date);

create index if not exists staffing_requests_profile_date_idx
  on public.staffing_requests (profile_id, target_date);

