-- Rack Builder: make the shared tool available to lights while keeping
-- project-owned data isolated by department. Catalog tables remain shared.

alter table public.rack_builder_projects
  add column if not exists department text;

update public.rack_builder_projects
set department = 'sound'
where department is null;

alter table public.rack_builder_projects
  alter column department set default 'sound',
  alter column department set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rack_builder_projects'::regclass
      and conname = 'rack_builder_projects_department_check'
  ) then
    alter table public.rack_builder_projects
      add constraint rack_builder_projects_department_check
      check (department = any (array['sound'::text, 'lights'::text]));
  end if;
end
$$;

create index if not exists rack_builder_projects_department_created_at_idx
  on public.rack_builder_projects (department, created_at desc);

create or replace function public.rack_builder_can_use_tool()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or public.is_admin_or_management()
    or lower(coalesce(public.current_user_department(), '')) = any (
      array['sound', 'lights', 'admin', 'management']
    );
$$;

create or replace function public.rack_builder_can_access_department(p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or public.is_admin_or_management()
    or lower(coalesce(public.current_user_department(), '')) = any (array['admin', 'management'])
    or (
      lower(coalesce(p_department, '')) = any (array['sound', 'lights'])
      and lower(coalesce(public.current_user_department(), '')) = lower(coalesce(p_department, ''))
    );
$$;

create or replace function public.rack_builder_can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.rack_builder_projects p
    where p.id = p_project_id
      and public.rack_builder_can_access_department(p.department)
  );
$$;

create or replace function public.rack_builder_can_access_layout(p_layout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.rack_builder_layouts l
    where l.id = p_layout_id
      and public.rack_builder_can_access_project(l.project_id)
  );
$$;

create or replace function public.rack_builder_can_access_panel_layout(p_panel_layout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.rack_builder_panel_layouts p
    where p.id = p_panel_layout_id
      and public.rack_builder_can_access_project(p.project_id)
  );
$$;

revoke all on function public.rack_builder_can_use_tool() from public, anon;
revoke all on function public.rack_builder_can_access_department(text) from public, anon;
revoke all on function public.rack_builder_can_access_project(uuid) from public, anon;
revoke all on function public.rack_builder_can_access_layout(uuid) from public, anon;
revoke all on function public.rack_builder_can_access_panel_layout(uuid) from public, anon;

grant execute on function public.rack_builder_can_use_tool() to authenticated, service_role;
grant execute on function public.rack_builder_can_access_department(text) to authenticated, service_role;
grant execute on function public.rack_builder_can_access_project(uuid) to authenticated, service_role;
grant execute on function public.rack_builder_can_access_layout(uuid) to authenticated, service_role;
grant execute on function public.rack_builder_can_access_panel_layout(uuid) to authenticated, service_role;

drop policy if exists rack_builder_racks_all on public.rack_builder_racks;
drop policy if exists rack_builder_device_categories_all on public.rack_builder_device_categories;
drop policy if exists rack_builder_devices_all on public.rack_builder_devices;
drop policy if exists rack_builder_projects_all on public.rack_builder_projects;
drop policy if exists rack_builder_layouts_all on public.rack_builder_layouts;
drop policy if exists rack_builder_connectors_all on public.rack_builder_connectors;
drop policy if exists rack_builder_panel_layouts_all on public.rack_builder_panel_layouts;
drop policy if exists rack_builder_panel_layout_rows_all on public.rack_builder_panel_layout_rows;
drop policy if exists rack_builder_panel_layout_ports_all on public.rack_builder_panel_layout_ports;
drop policy if exists rack_builder_layout_items_all on public.rack_builder_layout_items;

create policy rack_builder_racks_all on public.rack_builder_racks
  for all
  using (public.rack_builder_can_use_tool())
  with check (public.rack_builder_can_use_tool());

create policy rack_builder_device_categories_all on public.rack_builder_device_categories
  for all
  using (public.rack_builder_can_use_tool())
  with check (public.rack_builder_can_use_tool());

create policy rack_builder_devices_all on public.rack_builder_devices
  for all
  using (public.rack_builder_can_use_tool())
  with check (public.rack_builder_can_use_tool());

create policy rack_builder_projects_all on public.rack_builder_projects
  for all
  using (public.rack_builder_can_access_department(department))
  with check (public.rack_builder_can_access_department(department));

create policy rack_builder_layouts_all on public.rack_builder_layouts
  for all
  using (public.rack_builder_can_access_project(project_id))
  with check (public.rack_builder_can_access_project(project_id));

create policy rack_builder_connectors_all on public.rack_builder_connectors
  for all
  using (public.rack_builder_can_use_tool())
  with check (public.rack_builder_can_use_tool());

create policy rack_builder_panel_layouts_all on public.rack_builder_panel_layouts
  for all
  using (public.rack_builder_can_access_project(project_id))
  with check (public.rack_builder_can_access_project(project_id));

create policy rack_builder_panel_layout_rows_all on public.rack_builder_panel_layout_rows
  for all
  using (public.rack_builder_can_access_panel_layout(panel_layout_id))
  with check (public.rack_builder_can_access_panel_layout(panel_layout_id));

create policy rack_builder_panel_layout_ports_all on public.rack_builder_panel_layout_ports
  for all
  using (public.rack_builder_can_access_panel_layout(panel_layout_id))
  with check (public.rack_builder_can_access_panel_layout(panel_layout_id));

create policy rack_builder_layout_items_all on public.rack_builder_layout_items
  for all
  using (
    public.rack_builder_can_access_layout(layout_id)
    and (
      panel_layout_id is null
      or public.rack_builder_can_access_panel_layout(panel_layout_id)
    )
  )
  with check (
    public.rack_builder_can_access_layout(layout_id)
    and (
      panel_layout_id is null
      or public.rack_builder_can_access_panel_layout(panel_layout_id)
    )
  );

drop policy if exists rack_builder_device_images_select on storage.objects;
drop policy if exists rack_builder_device_images_insert on storage.objects;
drop policy if exists rack_builder_device_images_update on storage.objects;
drop policy if exists rack_builder_device_images_delete on storage.objects;
drop policy if exists rack_builder_connector_images_select on storage.objects;
drop policy if exists rack_builder_connector_images_insert on storage.objects;
drop policy if exists rack_builder_connector_images_update on storage.objects;
drop policy if exists rack_builder_connector_images_delete on storage.objects;

create policy rack_builder_device_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rack-builder-device-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_device_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rack-builder-device-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_device_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'rack-builder-device-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_device_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rack-builder-device-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_connector_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rack-builder-connector-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_connector_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rack-builder-connector-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_connector_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'rack-builder-connector-images'
    and public.rack_builder_can_use_tool()
  );

create policy rack_builder_connector_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rack-builder-connector-images'
    and public.rack_builder_can_use_tool()
  );

create or replace function public.rack_builder_validate_layout_item_semantics()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rack record;
  v_new_traits record;
  v_new_slot record;
  v_other record;
  v_other_traits record;
  v_other_slot record;
begin
  if auth.uid() is not null
    and coalesce(auth.role(), '') <> 'service_role'
    and (
      not public.rack_builder_can_use_tool()
      or not public.rack_builder_can_access_layout(new.layout_id)
      or (
        new.panel_layout_id is not null
        and not public.rack_builder_can_access_panel_layout(new.panel_layout_id)
      )
    )
  then
    raise exception 'RB_AUTH: rack builder placement requires access to this project'
      using errcode = '42501';
  end if;

  select r.id, r.rack_units, r.depth_mm, r.width
  into v_rack
  from rack_builder_layouts l
  join rack_builder_racks r on r.id = l.rack_id
  where l.id = new.layout_id;

  if not found then
    raise exception 'RB_BOUNDS: layout % has no rack', new.layout_id;
  end if;

  select *
  into v_new_traits
  from rack_builder_layout_item_traits(new.device_id, new.panel_layout_id);

  if new.start_u < 1 or new.start_u + v_new_traits.height_ru - 1 > v_rack.rack_units then
    raise exception
      'RB_BOUNDS: item % at U% with %U exceeds rack bounds 1..%U',
      coalesce(new.id::text, '<new>'),
      new.start_u,
      v_new_traits.height_ru,
      v_rack.rack_units;
  end if;

  select *
  into v_new_slot
  from rack_builder_layout_item_slot(
    v_rack.width,
    new.preferred_lane,
    new.preferred_sub_lane,
    v_new_traits.is_half_rack,
    new.force_full_width
  );

  for v_other in
    select *
    from rack_builder_layout_items
    where layout_id = new.layout_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    select *
    into v_other_traits
    from rack_builder_layout_item_traits(v_other.device_id, v_other.panel_layout_id);

    if not rack_builder_u_ranges_overlap(new.start_u, v_new_traits.height_ru, v_other.start_u, v_other_traits.height_ru) then
      continue;
    end if;

    select *
    into v_other_slot
    from rack_builder_layout_item_slot(
      v_rack.width,
      v_other.preferred_lane,
      v_other.preferred_sub_lane,
      v_other_traits.is_half_rack,
      v_other.force_full_width
    );

    if not rack_builder_slots_conflict(
      v_new_slot.outer_lane,
      v_new_slot.inner_lane,
      v_other_slot.outer_lane,
      v_other_slot.inner_lane
    ) then
      continue;
    end if;

    if v_other.facing = new.facing then
      raise exception
        'RB_SLOT: item % overlaps item % on facing %',
        coalesce(new.id::text, '<new>'),
        v_other.id,
        new.facing;
    end if;

    if v_new_traits.depth_mm + v_other_traits.depth_mm > v_rack.depth_mm then
      raise exception
        'RB_DEPTH: item % (%mm) collides with item % (%mm) in rack depth %mm',
        coalesce(new.id::text, '<new>'),
        v_new_traits.depth_mm,
        v_other.id,
        v_other_traits.depth_mm,
        v_rack.depth_mm;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.rack_builder_validate_layout_item_semantics() from public, anon;
