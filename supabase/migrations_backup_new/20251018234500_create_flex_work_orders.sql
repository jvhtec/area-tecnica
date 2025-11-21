-- Create table to track Flex work orders generated per technician/job
create table if not exists public.flex_work_orders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  flex_document_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, technician_id)
);

create index if not exists idx_flex_work_orders_job on public.flex_work_orders(job_id);
create index if not exists idx_flex_work_orders_technician on public.flex_work_orders(technician_id);

-- Maintain updated_at automatically
create trigger set_flex_work_orders_updated_at
  before update on public.flex_work_orders
  for each row execute function public.set_updated_at();

alter table public.flex_work_orders enable row level security;

drop policy if exists "Management can manage flex work orders" on public.flex_work_orders;
create policy "Management can manage flex work orders"
  on public.flex_work_orders
  for all to authenticated
  using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]))
  with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

-- Allow service role full access for automation tasks
grant all on public.flex_work_orders to service_role;
