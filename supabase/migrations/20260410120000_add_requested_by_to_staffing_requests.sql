alter table public.staffing_requests
add column if not exists requested_by uuid null
  constraint fk_staffing_requests_requested_by
  references public.profiles(id)
  on delete set null;

create index if not exists idx_staffing_requests_requested_by on public.staffing_requests(requested_by);
