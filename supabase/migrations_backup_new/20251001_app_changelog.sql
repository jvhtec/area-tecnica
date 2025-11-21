-- Create app_changelog table for About popup changelog
create table if not exists public.app_changelog (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  entry_date date not null default (now() at time zone 'utc')::date,
  content text not null,
  last_updated timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes to speed ordering
create index if not exists idx_app_changelog_entry_date_desc on public.app_changelog (entry_date desc);
create index if not exists idx_app_changelog_last_updated_desc on public.app_changelog (last_updated desc);

-- Trigger to keep last_updated fresh
create or replace function public.fn_app_changelog_touch()
returns trigger as $$
begin
  new.last_updated = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_app_changelog_touch on public.app_changelog;
create trigger trg_app_changelog_touch
before update on public.app_changelog
for each row
execute function public.fn_app_changelog_touch();

-- Enable RLS and policies
alter table public.app_changelog enable row level security;

-- Select: any authenticated user can read
drop policy if exists "app_changelog_select_auth" on public.app_changelog;
create policy "app_changelog_select_auth"
on public.app_changelog
for select
to authenticated
using (true);

-- Insert: management/admin or Javier (by email)
drop policy if exists "app_changelog_insert_editors" on public.app_changelog;
create policy "app_changelog_insert_editors"
on public.app_changelog
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['management'::user_role,'admin'::user_role])
  )
  or lower(coalesce(auth.jwt() ->> 'email','')) = 'sonido@sector-pro.com'
);

-- Update: same as insert
drop policy if exists "app_changelog_update_editors" on public.app_changelog;
create policy "app_changelog_update_editors"
on public.app_changelog
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['management'::user_role,'admin'::user_role])
  )
  or lower(coalesce(auth.jwt() ->> 'email','')) = 'sonido@sector-pro.com'
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['management'::user_role,'admin'::user_role])
  )
  or lower(coalesce(auth.jwt() ->> 'email','')) = 'sonido@sector-pro.com'
);

-- (Optional) Deletes: restrict to admins only
drop policy if exists "app_changelog_delete_admin" on public.app_changelog;
create policy "app_changelog_delete_admin"
on public.app_changelog
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::user_role
  )
);
