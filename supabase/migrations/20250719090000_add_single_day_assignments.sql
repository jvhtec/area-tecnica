alter table public.job_assignments
  add column if not exists single_day boolean not null default false,
  add column if not exists assignment_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_assignments_single_day_check'
      and conrelid = 'public.job_assignments'::regclass
  ) then
    alter table public.job_assignments
      add constraint job_assignments_single_day_check
      check (single_day = false or assignment_date is not null);
  end if;
end $$;

create index if not exists job_assignments_assignment_date_idx
  on public.job_assignments (assignment_date);
