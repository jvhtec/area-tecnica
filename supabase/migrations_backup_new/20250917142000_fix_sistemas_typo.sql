-- Fix sound skill typo: replace 'sistemnas' with 'sistemas'

-- Ensure correct skill exists and is active
insert into public.skills (name, category, active)
values ('sistemas', 'sound-specialty', true)
on conflict (name) do update set category = excluded.category, active = true;

-- Migrate any profile_skills rows from the wrong skill to the correct one
update public.profile_skills ps
set skill_id = s_correct.id
from public.skills s_wrong, public.skills s_correct
where s_wrong.name = 'sistemnas'
  and s_correct.name = 'sistemas'
  and ps.skill_id = s_wrong.id;

-- Deactivate the misspelled skill if present
update public.skills set active = false where name = 'sistemnas';

