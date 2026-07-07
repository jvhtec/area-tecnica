-- Rack Builder placement validation reads related racks, layouts, devices,
-- panel layouts, and existing layout items while an insert/update is in flight.
-- In Area Tecnica those tables are protected by RLS, unlike the standalone
-- source project. Keep the same backend-authoritative placement semantics, but
-- execute the trigger with owner privileges after first checking the caller
-- still has Rack Builder access.

alter function public.rack_builder_layout_item_traits(uuid, uuid)
  set search_path = public, pg_temp;

alter function public.rack_builder_layout_item_slot(
  public.rack_builder_rack_width,
  integer,
  integer,
  boolean,
  boolean
) set search_path = public, pg_temp;

alter function public.rack_builder_u_ranges_overlap(integer, integer, integer, integer)
  set search_path = public, pg_temp;

alter function public.rack_builder_slots_conflict(integer, integer, integer, integer)
  set search_path = public, pg_temp;

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
    and not (
      public.current_user_department() = any (array['sound', 'admin', 'management'])
      or public.is_admin_or_management()
    )
  then
    raise exception 'RB_AUTH: rack builder placement requires sound, admin, or management access'
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
