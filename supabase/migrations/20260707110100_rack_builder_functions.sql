-- Rack Builder: geometry validation triggers, drawing-revision bookkeeping,
-- and atomic panel-layout RPCs, ported from the standalone jvhtec/rack-builder
-- project (final-state behavior only; that project's own iterative history
-- is not preserved). All functions run SECURITY INVOKER (the default) so
-- they respect the RLS policies added in the companion RLS migration.

-- ---------------------------------------------------------------------------
-- Panel port geometry validation (bounds + overlap on insert/update)
-- ---------------------------------------------------------------------------

create or replace function rack_builder_validate_panel_layout_port_geometry()
returns trigger
language plpgsql
as $$
declare
  target_hole_count integer;
  overlap_count integer;
begin
  select hole_count into target_hole_count
  from rack_builder_panel_layout_rows
  where panel_layout_id = new.panel_layout_id and row_index = new.row_index;

  if target_hole_count is null then
    raise exception 'RB_ROW: target row does not exist for panel_layout_id=% row_index=%', new.panel_layout_id, new.row_index;
  end if;

  if new.hole_index < 0 or new.hole_index + new.span_w > target_hole_count then
    raise exception 'RB_PORT_BOUNDS: hole_index=% span_w=% but row has % holes', new.hole_index, new.span_w, target_hole_count;
  end if;

  select count(*) into overlap_count
  from rack_builder_panel_layout_ports
  where panel_layout_id = new.panel_layout_id
    and row_index = new.row_index
    and id is distinct from new.id
    and hole_index < new.hole_index + new.span_w
    and hole_index + span_w > new.hole_index;

  if overlap_count > 0 then
    raise exception 'RB_PORT_OVERLAP: port overlaps with existing port on row_index=%', new.row_index;
  end if;

  return new;
end;
$$;

revoke all on function rack_builder_validate_panel_layout_port_geometry() from public, anon;

create trigger rack_builder_trg_validate_panel_layout_port_geometry
  before insert or update on rack_builder_panel_layout_ports
  for each row execute function rack_builder_validate_panel_layout_port_geometry();

create or replace function rack_builder_validate_panel_layout_row_ports()
returns trigger
language plpgsql
as $$
declare
  violating_port record;
begin
  if new.hole_count < old.hole_count then
    select id, hole_index, span_w into violating_port
    from rack_builder_panel_layout_ports
    where panel_layout_id = new.panel_layout_id
      and row_index = new.row_index
      and hole_index + span_w > new.hole_count
    limit 1;

    if found then
      raise exception 'RB_ROW_SHRINK: cannot reduce hole_count to %: port id=% at hole_index=% with span_w=% would exceed bounds',
        new.hole_count, violating_port.id, violating_port.hole_index, violating_port.span_w;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function rack_builder_validate_panel_layout_row_ports() from public, anon;

create trigger rack_builder_trg_validate_panel_layout_row_port_geometry
  before update on rack_builder_panel_layout_rows
  for each row execute function rack_builder_validate_panel_layout_row_ports();

-- ---------------------------------------------------------------------------
-- Layout item slot/depth semantics (backend-authoritative rack placement)
-- ---------------------------------------------------------------------------

create or replace function rack_builder_layout_item_traits(
  p_device_id uuid,
  p_panel_layout_id uuid
)
returns table (height_ru integer, depth_mm integer, is_half_rack boolean)
language plpgsql
as $$
begin
  if p_device_id is not null then
    return query
    select d.rack_units, d.depth_mm, d.is_half_rack
    from rack_builder_devices d
    where d.id = p_device_id;

    if found then
      return;
    end if;

    raise exception 'RB_SLOT: device % not found', p_device_id;
  end if;

  if p_panel_layout_id is not null then
    return query
    select p.height_ru, p.depth_mm, false
    from rack_builder_panel_layouts p
    where p.id = p_panel_layout_id;

    if found then
      return;
    end if;

    raise exception 'RB_SLOT: panel_layout % not found', p_panel_layout_id;
  end if;

  raise exception 'RB_SLOT: layout item must reference a device or panel layout';
end;
$$;

revoke all on function rack_builder_layout_item_traits(uuid, uuid) from public, anon;
grant execute on function rack_builder_layout_item_traits(uuid, uuid) to authenticated;

create or replace function rack_builder_layout_item_slot(
  p_rack_width rack_builder_rack_width,
  p_preferred_lane integer,
  p_preferred_sub_lane integer,
  p_is_half_rack boolean,
  p_force_full_width boolean
)
returns table (outer_lane integer, inner_lane integer)
language plpgsql
as $$
declare
  lane integer;
begin
  if p_rack_width = 'single' then
    if not p_is_half_rack or p_force_full_width then
      return query select null::integer, null::integer;
      return;
    end if;

    lane := case when p_preferred_lane = 1 then 1 else 0 end;
    return query select lane, null::integer;
    return;
  end if;

  lane := case when p_preferred_lane = 1 then 1 else 0 end;
  if not p_is_half_rack or p_force_full_width then
    return query select lane, null::integer;
    return;
  end if;

  return query
  select lane, case when p_preferred_sub_lane = 1 then 1 else 0 end;
end;
$$;

revoke all on function rack_builder_layout_item_slot(rack_builder_rack_width, integer, integer, boolean, boolean) from public, anon;
grant execute on function rack_builder_layout_item_slot(rack_builder_rack_width, integer, integer, boolean, boolean) to authenticated;

create or replace function rack_builder_u_ranges_overlap(
  p_start_a integer, p_height_a integer, p_start_b integer, p_height_b integer
)
returns boolean
language sql
immutable
as $$
  select
    p_start_a <= (p_start_b + p_height_b - 1)
    and (p_start_a + p_height_a - 1) >= p_start_b
$$;

revoke all on function rack_builder_u_ranges_overlap(integer, integer, integer, integer) from public, anon;
grant execute on function rack_builder_u_ranges_overlap(integer, integer, integer, integer) to authenticated;

create or replace function rack_builder_slots_conflict(
  p_outer_a integer, p_inner_a integer, p_outer_b integer, p_inner_b integer
)
returns boolean
language sql
immutable
as $$
  select
    case
      when p_outer_a is null or p_outer_b is null then true
      when p_outer_a <> p_outer_b then false
      when p_inner_a is null or p_inner_b is null then true
      else p_inner_a = p_inner_b
    end
$$;

revoke all on function rack_builder_slots_conflict(integer, integer, integer, integer) from public, anon;
grant execute on function rack_builder_slots_conflict(integer, integer, integer, integer) to authenticated;

create or replace function rack_builder_validate_layout_item_semantics()
returns trigger
language plpgsql
as $$
declare
  v_rack record;
  v_new_traits record;
  v_new_slot record;
  v_other record;
  v_other_traits record;
  v_other_slot record;
begin
  select r.id, r.rack_units, r.depth_mm, r.width
  into v_rack
  from rack_builder_layouts l
  join rack_builder_racks r on r.id = l.rack_id
  where l.id = new.layout_id;

  if not found then
    raise exception 'RB_BOUNDS: layout % has no rack', new.layout_id;
  end if;

  select * into v_new_traits
  from rack_builder_layout_item_traits(new.device_id, new.panel_layout_id);

  if new.start_u < 1 or new.start_u + v_new_traits.height_ru - 1 > v_rack.rack_units then
    raise exception
      'RB_BOUNDS: item % at U% with %U exceeds rack bounds 1..%U',
      coalesce(new.id::text, '<new>'), new.start_u, v_new_traits.height_ru, v_rack.rack_units;
  end if;

  select * into v_new_slot
  from rack_builder_layout_item_slot(
    v_rack.width, new.preferred_lane, new.preferred_sub_lane, v_new_traits.is_half_rack, new.force_full_width
  );

  for v_other in
    select *
    from rack_builder_layout_items
    where layout_id = new.layout_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    select * into v_other_traits
    from rack_builder_layout_item_traits(v_other.device_id, v_other.panel_layout_id);

    if not rack_builder_u_ranges_overlap(new.start_u, v_new_traits.height_ru, v_other.start_u, v_other_traits.height_ru) then
      continue;
    end if;

    select * into v_other_slot
    from rack_builder_layout_item_slot(
      v_rack.width, v_other.preferred_lane, v_other.preferred_sub_lane, v_other_traits.is_half_rack, v_other.force_full_width
    );

    if not rack_builder_slots_conflict(
      v_new_slot.outer_lane, v_new_slot.inner_lane, v_other_slot.outer_lane, v_other_slot.inner_lane
    ) then
      continue;
    end if;

    if v_other.facing = new.facing then
      raise exception
        'RB_SLOT: item % overlaps item % on facing %',
        coalesce(new.id::text, '<new>'), v_other.id, new.facing;
    end if;

    if v_new_traits.depth_mm + v_other_traits.depth_mm > v_rack.depth_mm then
      raise exception
        'RB_DEPTH: item % (%mm) collides with item % (%mm) in rack depth %mm',
        coalesce(new.id::text, '<new>'), v_new_traits.depth_mm, v_other.id, v_other_traits.depth_mm, v_rack.depth_mm;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function rack_builder_validate_layout_item_semantics() from public, anon;

create trigger rack_builder_trg_validate_layout_item_semantics
  before insert or update on rack_builder_layout_items
  for each row execute function rack_builder_validate_layout_item_semantics();

-- ---------------------------------------------------------------------------
-- Drawing-state revision bookkeeping (projects / layouts / panel_layouts)
-- ---------------------------------------------------------------------------

create or replace function rack_builder_set_drawing_revision_on_update()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    if new.drawing_state = 'rev' then
      new.revision_number := old.revision_number + 1;
    else
      new.revision_number := old.revision_number;
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function rack_builder_set_drawing_revision_on_update() from public, anon;

create trigger rack_builder_projects_drawing_revision_trigger
  before update on rack_builder_projects
  for each row execute function rack_builder_set_drawing_revision_on_update();

create trigger rack_builder_layouts_drawing_revision_trigger
  before update on rack_builder_layouts
  for each row execute function rack_builder_set_drawing_revision_on_update();

create trigger rack_builder_panel_layouts_drawing_revision_trigger
  before update on rack_builder_panel_layouts
  for each row execute function rack_builder_set_drawing_revision_on_update();

-- Project drawing_state 'as_built' propagates to (and reverts from) its
-- layouts/panel_layouts.
create or replace function rack_builder_propagate_project_as_built_to_children()
returns trigger
language plpgsql
as $$
begin
  if new.drawing_state = 'as_built' and old.drawing_state is distinct from new.drawing_state then
    update rack_builder_layouts
    set drawing_state = 'as_built', updated_at = now()
    where project_id = new.id and drawing_state <> 'as_built';

    update rack_builder_panel_layouts
    set drawing_state = 'as_built', updated_at = now()
    where project_id = new.id and drawing_state <> 'as_built';
  elsif old.drawing_state = 'as_built' and new.drawing_state is distinct from old.drawing_state then
    update rack_builder_layouts
    set drawing_state = new.drawing_state, updated_at = now()
    where project_id = new.id and drawing_state = 'as_built';

    update rack_builder_panel_layouts
    set drawing_state = new.drawing_state, updated_at = now()
    where project_id = new.id and drawing_state = 'as_built';
  end if;

  return null;
end;
$$;

revoke all on function rack_builder_propagate_project_as_built_to_children() from public, anon;

create trigger rack_builder_projects_as_built_propagation_trigger
  after update on rack_builder_projects
  for each row execute function rack_builder_propagate_project_as_built_to_children();

-- Mutating a layout's items (or a panel layout's rows/ports) bumps the
-- parent's revision_number when it's mid-revision, and always touches updated_at.
create or replace function rack_builder_touch_layout_on_layout_item_mutation()
returns trigger
language plpgsql
as $$
declare
  target_layout_id uuid;
begin
  target_layout_id := coalesce(new.layout_id, old.layout_id);
  if target_layout_id is null then
    return null;
  end if;

  update rack_builder_layouts
  set
    revision_number = case when drawing_state = 'rev' then revision_number + 1 else revision_number end,
    updated_at = now()
  where id = target_layout_id;

  return null;
end;
$$;

revoke all on function rack_builder_touch_layout_on_layout_item_mutation() from public, anon;

create trigger rack_builder_layout_items_touch_layout_insert_trigger
  after insert on rack_builder_layout_items
  for each row execute function rack_builder_touch_layout_on_layout_item_mutation();

create trigger rack_builder_layout_items_touch_layout_update_trigger
  after update on rack_builder_layout_items
  for each row execute function rack_builder_touch_layout_on_layout_item_mutation();

create trigger rack_builder_layout_items_touch_layout_delete_trigger
  after delete on rack_builder_layout_items
  for each row execute function rack_builder_touch_layout_on_layout_item_mutation();

-- Statement-level (transition-table) variants for panel_layout_rows/ports,
-- so a bulk row/port replace only issues one UPDATE against panel_layouts.
create or replace function rack_builder_touch_panel_layouts_from_new_rows()
returns trigger
language plpgsql
as $$
begin
  update rack_builder_panel_layouts p
  set revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
      updated_at = now()
  where p.id in (select distinct panel_layout_id from new_rows);
  return null;
end;
$$;

create or replace function rack_builder_touch_panel_layouts_from_old_rows()
returns trigger
language plpgsql
as $$
begin
  update rack_builder_panel_layouts p
  set revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
      updated_at = now()
  where p.id in (select distinct panel_layout_id from old_rows);
  return null;
end;
$$;

create or replace function rack_builder_touch_panel_layouts_from_old_and_new_rows()
returns trigger
language plpgsql
as $$
begin
  update rack_builder_panel_layouts p
  set revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
      updated_at = now()
  where p.id in (
    select distinct panel_layout_id from new_rows
    union
    select distinct panel_layout_id from old_rows
  );
  return null;
end;
$$;

revoke all on function rack_builder_touch_panel_layouts_from_new_rows() from public, anon;
revoke all on function rack_builder_touch_panel_layouts_from_old_rows() from public, anon;
revoke all on function rack_builder_touch_panel_layouts_from_old_and_new_rows() from public, anon;

create trigger rack_builder_panel_layout_rows_touch_panel_insert_trigger
  after insert on rack_builder_panel_layout_rows
  referencing new table as new_rows
  for each statement execute function rack_builder_touch_panel_layouts_from_new_rows();

create trigger rack_builder_panel_layout_rows_touch_panel_update_trigger
  after update on rack_builder_panel_layout_rows
  referencing old table as old_rows new table as new_rows
  for each statement execute function rack_builder_touch_panel_layouts_from_old_and_new_rows();

create trigger rack_builder_panel_layout_rows_touch_panel_delete_trigger
  after delete on rack_builder_panel_layout_rows
  referencing old table as old_rows
  for each statement execute function rack_builder_touch_panel_layouts_from_old_rows();

create or replace function rack_builder_touch_panel_layouts_from_new_ports()
returns trigger
language plpgsql
as $$
begin
  update rack_builder_panel_layouts p
  set revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
      updated_at = now()
  where p.id in (select distinct panel_layout_id from new_ports);
  return null;
end;
$$;

create or replace function rack_builder_touch_panel_layouts_from_old_ports()
returns trigger
language plpgsql
as $$
begin
  update rack_builder_panel_layouts p
  set revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
      updated_at = now()
  where p.id in (select distinct panel_layout_id from old_ports);
  return null;
end;
$$;

create or replace function rack_builder_touch_panel_layouts_from_old_and_new_ports()
returns trigger
language plpgsql
as $$
begin
  update rack_builder_panel_layouts p
  set revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
      updated_at = now()
  where p.id in (
    select distinct panel_layout_id from new_ports
    union
    select distinct panel_layout_id from old_ports
  );
  return null;
end;
$$;

revoke all on function rack_builder_touch_panel_layouts_from_new_ports() from public, anon;
revoke all on function rack_builder_touch_panel_layouts_from_old_ports() from public, anon;
revoke all on function rack_builder_touch_panel_layouts_from_old_and_new_ports() from public, anon;

create trigger rack_builder_panel_layout_ports_touch_panel_insert_trigger
  after insert on rack_builder_panel_layout_ports
  referencing new table as new_ports
  for each statement execute function rack_builder_touch_panel_layouts_from_new_ports();

create trigger rack_builder_panel_layout_ports_touch_panel_update_trigger
  after update on rack_builder_panel_layout_ports
  referencing old table as old_ports new table as new_ports
  for each statement execute function rack_builder_touch_panel_layouts_from_old_and_new_ports();

create trigger rack_builder_panel_layout_ports_touch_panel_delete_trigger
  after delete on rack_builder_panel_layout_ports
  referencing old table as old_ports
  for each statement execute function rack_builder_touch_panel_layouts_from_old_ports();

-- ---------------------------------------------------------------------------
-- Atomic panel-layout RPCs (called from the frontend via supabase-js .rpc())
-- ---------------------------------------------------------------------------

create or replace function rack_builder_rpc_create_panel_layout(
  p_project_id uuid,
  p_name text,
  p_drawing_state rack_builder_drawing_state,
  p_height_ru integer,
  p_facing rack_builder_device_facing,
  p_has_lacing_bar boolean,
  p_notes text,
  p_weight_kg numeric,
  p_default_hole_count integer
) returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into rack_builder_panel_layouts (project_id, name, drawing_state, height_ru, facing, has_lacing_bar, notes, weight_kg)
  values (p_project_id, p_name, p_drawing_state, p_height_ru, p_facing, p_has_lacing_bar, p_notes, p_weight_kg)
  returning id into new_id;

  insert into rack_builder_panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
  select new_id, gs.idx, p_default_hole_count, '[]'::jsonb
  from generate_series(0, p_height_ru - 1) as gs(idx);

  return new_id;
end;
$$;

revoke all on function rack_builder_rpc_create_panel_layout(uuid, text, rack_builder_drawing_state, integer, rack_builder_device_facing, boolean, text, numeric, integer) from public, anon;
grant execute on function rack_builder_rpc_create_panel_layout(uuid, text, rack_builder_drawing_state, integer, rack_builder_device_facing, boolean, text, numeric, integer) to authenticated;

create or replace function rack_builder_rpc_save_panel_layout(
  p_id uuid,
  p_name text,
  p_drawing_state rack_builder_drawing_state,
  p_facing rack_builder_device_facing,
  p_has_lacing_bar boolean,
  p_notes text,
  p_rows jsonb,
  p_ports jsonb
) returns void
language plpgsql
as $$
begin
  update rack_builder_panel_layouts set
    name = p_name,
    drawing_state = p_drawing_state,
    facing = p_facing,
    has_lacing_bar = p_has_lacing_bar,
    notes = p_notes,
    updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'Panel layout % not found', p_id;
  end if;

  delete from rack_builder_panel_layout_rows where panel_layout_id = p_id;

  if jsonb_array_length(p_rows) > 0 then
    insert into rack_builder_panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
    select p_id, (elem->>'row_index')::integer, (elem->>'hole_count')::integer, elem->'active_column_map'
    from jsonb_array_elements(p_rows) as elem;
  end if;

  delete from rack_builder_panel_layout_ports where panel_layout_id = p_id;

  if jsonb_array_length(p_ports) > 0 then
    insert into rack_builder_panel_layout_ports (panel_layout_id, connector_id, row_index, hole_index, span_w, span_h, label, color)
    select
      p_id, elem->>'connector_id', (elem->>'row_index')::integer, (elem->>'hole_index')::integer,
      (elem->>'span_w')::integer, (elem->>'span_h')::integer, elem->>'label', elem->>'color'
    from jsonb_array_elements(p_ports) as elem;
  end if;
end;
$$;

revoke all on function rack_builder_rpc_save_panel_layout(uuid, text, rack_builder_drawing_state, rack_builder_device_facing, boolean, text, jsonb, jsonb) from public, anon;
grant execute on function rack_builder_rpc_save_panel_layout(uuid, text, rack_builder_drawing_state, rack_builder_device_facing, boolean, text, jsonb, jsonb) to authenticated;

create or replace function rack_builder_rpc_duplicate_panel_layout(
  p_source_id uuid,
  p_project_id uuid,
  p_new_name text
) returns uuid
language plpgsql
as $$
declare
  new_id uuid;
  src rack_builder_panel_layouts%rowtype;
begin
  select * into src from rack_builder_panel_layouts where id = p_source_id;
  if not found then
    raise exception 'Source panel layout % not found', p_source_id;
  end if;

  insert into rack_builder_panel_layouts (project_id, name, drawing_state, height_ru, facing, has_lacing_bar, notes, weight_kg, depth_mm)
  values (p_project_id, p_new_name, src.drawing_state, src.height_ru, src.facing, src.has_lacing_bar, src.notes, src.weight_kg, src.depth_mm)
  returning id into new_id;

  insert into rack_builder_panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
  select new_id, row_index, hole_count, active_column_map
  from rack_builder_panel_layout_rows
  where panel_layout_id = p_source_id;

  insert into rack_builder_panel_layout_ports (panel_layout_id, connector_id, row_index, hole_index, span_w, span_h, label, color)
  select new_id, connector_id, row_index, hole_index, span_w, span_h, label, color
  from rack_builder_panel_layout_ports
  where panel_layout_id = p_source_id;

  return new_id;
end;
$$;

revoke all on function rack_builder_rpc_duplicate_panel_layout(uuid, uuid, text) from public, anon;
grant execute on function rack_builder_rpc_duplicate_panel_layout(uuid, uuid, text) to authenticated;

create or replace function rack_builder_rpc_replace_panel_layout_rows(
  p_panel_layout_id uuid,
  p_rows jsonb
) returns void
language plpgsql
as $$
begin
  delete from rack_builder_panel_layout_rows where panel_layout_id = p_panel_layout_id;

  if jsonb_array_length(p_rows) > 0 then
    insert into rack_builder_panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
    select p_panel_layout_id, (elem->>'row_index')::integer, (elem->>'hole_count')::integer, elem->'active_column_map'
    from jsonb_array_elements(p_rows) as elem;
  end if;
end;
$$;

revoke all on function rack_builder_rpc_replace_panel_layout_rows(uuid, jsonb) from public, anon;
grant execute on function rack_builder_rpc_replace_panel_layout_rows(uuid, jsonb) to authenticated;

create or replace function rack_builder_rpc_replace_panel_layout_ports(
  p_panel_layout_id uuid,
  p_ports jsonb
) returns void
language plpgsql
as $$
begin
  delete from rack_builder_panel_layout_ports where panel_layout_id = p_panel_layout_id;

  if jsonb_array_length(p_ports) > 0 then
    insert into rack_builder_panel_layout_ports (panel_layout_id, connector_id, row_index, hole_index, span_w, span_h, label, color)
    select
      p_panel_layout_id, elem->>'connector_id', (elem->>'row_index')::integer, (elem->>'hole_index')::integer,
      (elem->>'span_w')::integer, (elem->>'span_h')::integer, elem->>'label', elem->>'color'
    from jsonb_array_elements(p_ports) as elem;
  end if;
end;
$$;

revoke all on function rack_builder_rpc_replace_panel_layout_ports(uuid, jsonb) from public, anon;
grant execute on function rack_builder_rpc_replace_panel_layout_ports(uuid, jsonb) to authenticated;
