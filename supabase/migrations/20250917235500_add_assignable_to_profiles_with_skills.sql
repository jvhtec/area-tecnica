-- Recreate profiles_with_skills view to include assignable_as_tech

drop view if exists public.profiles_with_skills;
create or replace view public.profiles_with_skills as
select
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  p.phone,
  p.dni,
  p.department,
  p.assignable_as_tech,
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
group by p.id, p.first_name, p.last_name, p.email, p.role, p.phone, p.dni, p.department, p.assignable_as_tech;

