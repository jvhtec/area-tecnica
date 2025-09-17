-- Add items table for multi-vehicle transport requests and relax transport_type on requests
alter table public.transport_requests alter column transport_type drop not null;

create table if not exists public.transport_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.transport_requests(id) on delete cascade,
  transport_type text not null check (transport_type in ('trailer','9m','8m','6m','4m','furgoneta')),
  leftover_space_percent int check (leftover_space_percent >= 0 and leftover_space_percent <= 100),
  created_at timestamptz not null default now()
);

create index if not exists transport_request_items_request_idx on public.transport_request_items(request_id);

