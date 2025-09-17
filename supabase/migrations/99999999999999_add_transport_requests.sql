-- Transport requests table for technical departments to request logistics
create table if not exists public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null check (department in ('sound','lights','video')),
  transport_type text not null,
  note text,
  status text not null default 'requested' check (status in ('requested','fulfilled','cancelled')),
  created_by uuid not null references public.profiles(id) on delete set null,
  fulfilled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transport_requests_job_id_idx on public.transport_requests(job_id);
create index if not exists transport_requests_status_idx on public.transport_requests(status);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_transport_requests_updated_at on public.transport_requests;
create trigger set_transport_requests_updated_at
before update on public.transport_requests
for each row execute procedure public.set_updated_at();

