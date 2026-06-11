-- Quick presets for the technical calculators (Consumos / Pesos): a named
-- snapshot of a full table set that can be re-applied to any job or stage.

create table if not exists public.technical_tool_quick_presets (
  id uuid primary key default gen_random_uuid(),
  tool text not null check (tool in ('consumos', 'pesos')),
  department public.department not null,
  name text not null,
  tables jsonb not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null default auth.uid()
);

comment on table public.technical_tool_quick_presets is 'Named table-set snapshots for the Consumos/Pesos tools, reusable across jobs and stages.';
comment on column public.technical_tool_quick_presets.tables is 'Array of table snapshots (rows plus the electrical/weight metadata each tool needs to restore them).';

create unique index if not exists technical_tool_quick_presets_tool_department_name_key
  on public.technical_tool_quick_presets (tool, department, lower(name));

alter table public.technical_tool_quick_presets enable row level security;

drop policy if exists "technical_tool_quick_presets_select_authenticated" on public.technical_tool_quick_presets;
create policy "technical_tool_quick_presets_select_authenticated"
on public.technical_tool_quick_presets
for select
to authenticated
using (true);

drop policy if exists "technical_tool_quick_presets_insert_authenticated" on public.technical_tool_quick_presets;
create policy "technical_tool_quick_presets_insert_authenticated"
on public.technical_tool_quick_presets
for insert
to authenticated
with check (true);

drop policy if exists "technical_tool_quick_presets_update_owner_management" on public.technical_tool_quick_presets;
create policy "technical_tool_quick_presets_update_owner_management"
on public.technical_tool_quick_presets
for update
to authenticated
using (
  created_by = auth.uid()
  or public.get_current_user_role() = any (array['admin'::text, 'management'::text])
)
with check (
  created_by = auth.uid()
  or public.get_current_user_role() = any (array['admin'::text, 'management'::text])
);

drop policy if exists "technical_tool_quick_presets_delete_owner_management" on public.technical_tool_quick_presets;
create policy "technical_tool_quick_presets_delete_owner_management"
on public.technical_tool_quick_presets
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.get_current_user_role() = any (array['admin'::text, 'management'::text])
);

drop trigger if exists set_technical_tool_quick_presets_updated_at on public.technical_tool_quick_presets;
create trigger set_technical_tool_quick_presets_updated_at
before update on public.technical_tool_quick_presets
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on table public.technical_tool_quick_presets to authenticated;
grant all on table public.technical_tool_quick_presets to service_role;
