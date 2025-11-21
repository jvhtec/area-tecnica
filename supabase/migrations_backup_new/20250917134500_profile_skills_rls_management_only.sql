-- Restrict profile_skills modifications to management/admin only

-- Remove owner-managed policy if exists
drop policy if exists "Owner can manage own profile_skills" on public.profile_skills;

-- Ensure read policy remains for authenticated users
drop policy if exists "Authenticated can read profile_skills" on public.profile_skills;
create policy "Authenticated can read profile_skills"
on public.profile_skills
for select
using (auth.role() = 'authenticated');

-- Create management-only modification policy
drop policy if exists "Management can modify profile_skills" on public.profile_skills;
create policy "Management can modify profile_skills"
on public.profile_skills
for all
using (public.get_current_user_role() = any (array['admin'::text,'management'::text]))
with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));

