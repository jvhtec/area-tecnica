-- Technician fridge ("en la nevera") state
-- Allows management to mark technicians as temporarily excluded from assignment.

create table if not exists public.technician_fridge (
  technician_id uuid primary key references public.profiles(id) on delete cascade,
  in_fridge boolean not null default true,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null default auth.uid()
);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_technician_fridge_updated_at on public.technician_fridge;
create trigger set_technician_fridge_updated_at
before update on public.technician_fridge
for each row execute function public.set_updated_at();

-- Basic indexing
create index if not exists idx_technician_fridge_in_fridge on public.technician_fridge(in_fridge);

-- RLS
alter table public.technician_fridge enable row level security;

-- Read for authenticated users (matrix consumers)
drop policy if exists technician_fridge_select_all on public.technician_fridge;
create policy technician_fridge_select_all
on public.technician_fridge for select
using (auth.role() = 'authenticated');

-- Management/admin can insert/update/delete
drop policy if exists technician_fridge_modify_management on public.technician_fridge;
create policy technician_fridge_modify_management
on public.technician_fridge for all
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]))
with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

-- Realtime publication
do $$
begin
  execute 'alter publication supabase_realtime add table public.technician_fridge';
exception when others then null;
end $$;

