-- Skill names are compared case-insensitively everywhere that matters (the
-- matrix skills filter, role_skill_mapping lookups in the staffing ranking),
-- but skills.name was only unique case-sensitively. Production ended up with
-- both 'PA' (54 holders) and 'pa' (6 holders, created by the settings screen,
-- which lower-cases names): the filter listed both and each matched only part
-- of the crew.
--
-- 1. Merge every group of skills whose names differ only in case into one row:
--    the one with the most holders (oldest on a tie) keeps its id, takes the
--    lower-cased name the settings screen writes, and stays active if any row
--    in the group was. Holders of the other rows move to it; a technician who
--    already has it keeps their existing row.
-- 2. Make lower(name) unique so it cannot happen again.
-- 3. Publish skills to realtime, so the skills filter picks up skills created
--    or edited in settings without a reload (SELECT is open to everyone, and
--    the catalog changes a handful of times a year).

do $$
declare
  v_group record;
  v_keeper uuid;
  v_duplicate uuid;
begin
  for v_group in
    select lower(name) as name_key, bool_or(active) as any_active
    from public.skills
    group by lower(name)
    having count(*) > 1
  loop
    select s.id into v_keeper
    from public.skills s
    where lower(s.name) = v_group.name_key
    order by (select count(*) from public.profile_skills ps where ps.skill_id = s.id) desc,
             s.created_at,
             s.id
    limit 1;

    -- Move holders over where the technician does not already hold the keeper,
    -- one duplicate at a time so a technician holding several moves once.
    for v_duplicate in
      select id from public.skills
      where lower(name) = v_group.name_key and id <> v_keeper
      order by created_at, id
    loop
      update public.profile_skills ps
      set skill_id = v_keeper
      where ps.skill_id = v_duplicate
        and not exists (
          select 1 from public.profile_skills existing
          where existing.profile_id = ps.profile_id and existing.skill_id = v_keeper
        );
    end loop;

    -- Whatever is left on a duplicate belongs to a technician who holds both;
    -- their keeper row stays, and these go with the duplicate (ON DELETE CASCADE).
    delete from public.skills
    where lower(name) = v_group.name_key and id <> v_keeper;

    update public.skills
    set name = v_group.name_key,
        active = v_group.any_active
    where id = v_keeper;
  end loop;
end;
$$;

create unique index if not exists skills_name_lower_key on public.skills (lower(name));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'skills'
  ) then
    alter publication supabase_realtime add table public.skills;
  end if;
end;
$$;
