-- Group multiple single-day requests under one batch id to allow a unified email
alter table public.staffing_requests
  add column if not exists batch_id uuid;

create index if not exists staffing_requests_batch_idx
  on public.staffing_requests (batch_id);

