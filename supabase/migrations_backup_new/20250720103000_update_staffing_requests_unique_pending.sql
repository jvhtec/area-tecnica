-- Allow multiple pending staffing requests per job/profile/phase when targeting different single-day dates
-- Replace the previous single unique partial index with two more specific ones

do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uq_staffing_pending'
  ) then
    drop index public.uq_staffing_pending;
  end if;
exception when others then
  -- tolerate if it doesn't exist
  null;
end $$;

-- Unique pending for full-span (or unspecified date) requests
create unique index if not exists uq_staffing_pending_full_span
  on public.staffing_requests (job_id, profile_id, phase)
  where status = 'pending' and (single_day = false or target_date is null);

-- Unique pending per target date for single-day requests
create unique index if not exists uq_staffing_pending_single_day
  on public.staffing_requests (job_id, profile_id, phase, target_date)
  where status = 'pending' and single_day = true and target_date is not null;

