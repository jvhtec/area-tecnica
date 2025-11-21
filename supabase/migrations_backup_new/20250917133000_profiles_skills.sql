-- Create skills and profile_skills tables, seed defaults, and expose aggregated view

-- 1) Skills table
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.skills enable row level security;

-- Basic RLS: authenticated can read, admin/management can modify
drop policy if exists "Authenticated can read skills" on public.skills;
create policy "Authenticated can read skills"
on public.skills
for select
using (auth.role() = 'authenticated');

drop policy if exists "Admin or management can modify skills" on public.skills;
create policy "Admin or management can modify skills"
on public.skills
for all
using (public.get_current_user_role() = any (array['admin'::text,'management'::text]))
with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));

-- 2) Profile skills linking table
create table if not exists public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  proficiency int2 null check (proficiency between 0 and 5),
  is_primary boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  unique(profile_id, skill_id)
);

alter table public.profile_skills enable row level security;

-- RLS: authenticated can read, owners can manage their own, admin/management can manage all
drop policy if exists "Authenticated can read profile_skills" on public.profile_skills;
create policy "Authenticated can read profile_skills"
on public.profile_skills
for select
using (auth.role() = 'authenticated');

drop policy if exists "Owner can manage own profile_skills" on public.profile_skills;
create policy "Owner can manage own profile_skills"
on public.profile_skills
for all
using (profile_id = auth.uid() or public.get_current_user_role() = any (array['admin'::text,'management'::text]))
with check (profile_id = auth.uid() or public.get_current_user_role() = any (array['admin'::text,'management'::text]));

-- 3) Seed common skills
insert into public.skills (name, category) values
  ('foh', 'sound-specialty'),
  ('mon', 'sound-specialty'),
  ('rf', 'sound-specialty'),
  ('rf coordination', 'sound'),
  ('stage patching', 'sound'),
  ('lighting op', 'lights'),
  ('video op', 'video'),
  ('rigging', 'production'),
  ('truck driving', 'logistics')
on conflict (name) do nothing;

-- 4) Aggregated view for profiles with skills
drop view if exists public.profiles_with_skills;
create or replace view public.profiles_with_skills as
select
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  p.phone,
  p.department,
  coalesce(
    json_agg(
      jsonb_build_object(
        'name', s.name,
        'category', s.category,
        'proficiency', ps.proficiency,
        'is_primary', ps.is_primary
      )
      order by ps.is_primary desc nulls last, ps.proficiency desc nulls last, s.name asc
    ) filter (where s.id is not null),
    '[]'::json
  ) as skills
from public.profiles p
left join public.profile_skills ps on ps.profile_id = p.id
left join public.skills s on s.id = ps.skill_id and s.active is true
group by p.id, p.first_name, p.last_name, p.email, p.role, p.phone, p.department;

-- Note: view reads are governed by underlying table RLS. No separate policies needed.

