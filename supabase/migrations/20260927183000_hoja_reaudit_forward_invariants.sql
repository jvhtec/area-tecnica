-- Forward-only Hoja de Ruta re-audit fixes.
--
-- No historical workflow/image/rooming backfill is performed here. The goal is
-- to make every new edit obey the same review ownership and canonical rooming
-- contracts going forward.

create or replace function public._hoja_touch(p_hoja_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marker text := 'app.hoja_touched_' || replace(p_hoja_id::text, '-', '');
  v_previous text := coalesce(current_setting('app.hoja_trusted_write', true), '');
  v_job_id uuid;
  v_old_status text;
begin
  if p_hoja_id is null
     or coalesce(current_setting(v_marker, true), '') = statement_timestamp()::text then
    return;
  end if;

  select h.job_id, coalesce(h.status, 'draft')
    into v_job_id, v_old_status
  from public.hoja_de_ruta h
  where h.id = p_hoja_id;

  if not found then
    return;
  end if;

  perform set_config(v_marker, statement_timestamp()::text, true);
  perform set_config('app.hoja_trusted_write', 'on', true);

  update public.hoja_de_ruta h
  set
    document_version = coalesce(h.document_version, 0) + 1,
    status = case when h.status = 'approved' then 'review' else h.status end,
    approved_by = case when h.status = 'approved' then null else h.approved_by end,
    approved_at = case when h.status = 'approved' then null else h.approved_at end,
    -- Any reviewer-visible edit makes that editor the owner of the changed
    -- content. Otherwise B can edit A's review and immediately approve B's own
    -- changes because the requester would still point at A.
    review_requested_by = case
      when h.status in ('review', 'approved') then coalesce(auth.uid(), h.review_requested_by)
      else h.review_requested_by
    end,
    last_modified = now(),
    last_modified_by = coalesce(auth.uid(), h.last_modified_by),
    updated_at = now()
  where h.id = p_hoja_id;

  perform set_config('app.hoja_trusted_write', v_previous, true);

  if v_old_status = 'approved' then
    perform public._hoja_log_status_change(
      v_job_id, p_hoja_id, 'hoja.status.review', 'approved', 'review',
      jsonb_build_object('reason', 'edited_after_approval')
    );
  end if;
end;
$$;

-- Crew rooming still needs to display intentional free-text occupants (guest,
-- driver, external crew, etc.) when there is no canonical Hoja staff row.
-- Canonical staff identities remain preferred whenever the FK is populated.
create or replace function public.get_hoja_de_ruta(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoja_id uuid;
  v_full_access boolean;
  v_crew_visible boolean;
  v_role text := coalesce(public.get_current_user_role(), '');
  v_result jsonb;
begin
  v_full_access := coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or v_role in ('admin', 'management', 'logistics');

  if not v_full_access then
    if v_role not in ('technician', 'house_tech')
       or not exists (
         select 1 from public.job_assignments ja
         where ja.job_id = p_job_id
           and ja.technician_id = auth.uid()
           and ja.status = 'confirmed'
       ) then
      raise exception 'permission denied' using errcode = '42501';
    end if;
  end if;

  select h.id,
         coalesce(h.status, 'draft') in ('approved', 'final')
    into v_hoja_id, v_crew_visible
  from public.hoja_de_ruta h
  where h.job_id = p_job_id;

  if v_hoja_id is null then
    return null;
  end if;

  if not v_full_access and not v_crew_visible then
    return null;
  end if;

  select jsonb_build_object(
    'main', to_jsonb(h),
    'logistics', coalesce((
      select to_jsonb(l)
      from public.hoja_de_ruta_logistics l
      where l.hoja_de_ruta_id = h.id
    ), '{}'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order, c.id)
      from public.hoja_de_ruta_contacts c
      where c.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'staff', case when v_full_access then coalesce((
      select jsonb_agg(to_jsonb(s) order by s.sort_order, s.id)
      from public.hoja_de_ruta_staff s
      where s.hoja_de_ruta_id = h.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'transport', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort_order, t.id)
      from public.hoja_de_ruta_transport t
      where t.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'travelArrangements', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort_order, t.id)
      from public.hoja_de_ruta_travel_arrangements t
      where t.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'accommodations', coalesce((
      select jsonb_agg(
        to_jsonb(a) || jsonb_build_object(
          'rooms', coalesce((
            select jsonb_agg(
              case
                when v_full_access then to_jsonb(r)
                else jsonb_build_object(
                  'id', r.id,
                  'room_type', r.room_type,
                  'room_number', r.room_number,
                  'staff_member1_id', coalesce((
                    select s1.technician_id::text
                    from public.hoja_de_ruta_staff s1
                    where s1.id = r.staff_member1_hoja_staff_id
                      and s1.hoja_de_ruta_id = h.id
                  ), nullif(btrim(r.staff_member1_id), '')),
                  'staff_member1_name', coalesce((
                    select nullif(btrim(concat_ws(' ', s1.name, s1.surname1, s1.surname2)), '')
                    from public.hoja_de_ruta_staff s1
                    where s1.id = r.staff_member1_hoja_staff_id
                      and s1.hoja_de_ruta_id = h.id
                  ), nullif(btrim(r.staff_member1_id), '')),
                  'staff_member2_id', coalesce((
                    select s2.technician_id::text
                    from public.hoja_de_ruta_staff s2
                    where s2.id = r.staff_member2_hoja_staff_id
                      and s2.hoja_de_ruta_id = h.id
                  ), nullif(btrim(r.staff_member2_id), '')),
                  'staff_member2_name', coalesce((
                    select nullif(btrim(concat_ws(' ', s2.name, s2.surname1, s2.surname2)), '')
                    from public.hoja_de_ruta_staff s2
                    where s2.id = r.staff_member2_hoja_staff_id
                      and s2.hoja_de_ruta_id = h.id
                  ), nullif(btrim(r.staff_member2_id), ''))
                )
              end
              order by r.sort_order, r.id
            )
            from public.hoja_de_ruta_room_assignments r
            where r.accommodation_id = a.id
          ), '[]'::jsonb)
        )
        order by a.sort_order, a.id
      )
      from public.hoja_de_ruta_accommodations a
      where a.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'images', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.image_type, i.sort_order, i.id)
      from public.hoja_de_ruta_images i
      where i.hoja_de_ruta_id = h.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.hoja_de_ruta h
  where h.id = v_hoja_id;

  return v_result;
end;
$$;

create or replace function public.hoja_de_ruta_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ignored constant text[] := array[
    'published_document_id', 'approved_by', 'review_requested_by', 'created_by',
    'last_modified', 'last_modified_by', 'updated_at'
  ];
  v_old_content jsonb;
  v_new_content jsonb;
  v_top_level boolean := pg_trigger_depth() = 1;
  v_service boolean := public._hoja_is_service_role();
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.jobs j
      where j.id = new.job_id and j.job_type = 'dryhire'
    ) then
      raise exception 'Los trabajos de dry-hire no tienen Hoja de Ruta'
        using errcode = '22023';
    end if;

    if not public._hoja_trusted_write() and not v_service then
      new.status := 'draft';
      new.approved_by := null;
      new.approved_at := null;
      new.review_requested_by := null;
      new.published_document_id := null;
      new.document_version := 1;
    end if;
    return new;
  end if;

  if public._hoja_trusted_write() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if coalesce(old.status, 'draft') = 'final' and v_top_level and not v_service then
      raise exception 'La Hoja de Ruta está finalizada y no admite edición'
        using errcode = '22023';
    end if;
    return old;
  end if;

  v_old_content := to_jsonb(old) - v_ignored;
  v_new_content := to_jsonb(new) - v_ignored;

  if v_old_content = v_new_content
     and (
       not v_top_level
       or (
         new.published_document_id is not distinct from old.published_document_id
         and new.approved_by is not distinct from old.approved_by
         and new.review_requested_by is not distinct from old.review_requested_by
       )
     ) then
    return new;
  end if;

  if coalesce(old.status, 'draft') = 'final' and v_top_level and not v_service then
    raise exception 'La Hoja de Ruta está finalizada y no admite edición'
      using errcode = '22023';
  end if;

  if not v_service and (
    new.status is distinct from old.status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.review_requested_by is distinct from old.review_requested_by
    or new.document_version is distinct from old.document_version
    or new.published_document_id is distinct from old.published_document_id
  ) then
    raise exception 'El estado, la versión y la publicación de la Hoja de Ruta solo cambian desde su flujo de trabajo'
      using errcode = '42501';
  end if;

  if new.document_version is not distinct from old.document_version then
    new.document_version := coalesce(old.document_version, 0) + 1;
    if old.status = 'approved' then
      new.status := 'review';
      new.approved_by := null;
      new.approved_at := null;
    end if;
    if old.status in ('review', 'approved') then
      new.review_requested_by := coalesce(auth.uid(), old.review_requested_by);
    end if;
  end if;
  new.last_modified := now();
  new.updated_at := now();

  perform set_config(
    'app.hoja_touched_' || replace(new.id::text, '-', ''),
    statement_timestamp()::text,
    true
  );

  if old.status = 'approved' and new.status = 'review' then
    perform public._hoja_log_status_change(
      new.job_id, new.id, 'hoja.status.review', 'approved', 'review',
      jsonb_build_object('reason', 'edited_after_approval')
    );
  end if;

  return new;
end;
$$;

create or replace function public.save_hoja_de_ruta(
  p_job_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_removed_image_ids uuid[]
)
returns table(id uuid, document_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saved record;
  v_legacy_images jsonb := '[]'::jsonb;
  v_removed uuid[] := coalesce(array_remove(p_removed_image_ids, null), '{}'::uuid[]);
  v_previous_status text;
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.job_type = 'dryhire'
  ) then
    raise exception 'Los trabajos de dry-hire no tienen Hoja de Ruta'
      using errcode = '22023';
  end if;

  select coalesce(h.status, 'draft') into v_previous_status
  from public.hoja_de_ruta h
  where h.job_id = p_job_id;

  -- Existing legacy-image compatibility stays untouched, but this migration
  -- deliberately does not add any new historical backfill/preservation logic.
  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    into v_legacy_images
  from public.hoja_de_ruta h
  join public.hoja_de_ruta_images i on i.hoja_de_ruta_id = h.id
  where h.job_id = p_job_id
    and (i.image_path like 'blob:%' or i.image_path like 'data:%');

  perform set_config('app.hoja_trusted_write', 'on', true);

  select saved.id, saved.document_version
    into v_saved
  from public.save_hoja_de_ruta(p_job_id, p_expected_version, p_payload) saved;

  perform set_config('app.allow_legacy_hoja_image_delete', 'on', true);
  delete from public.hoja_de_ruta_images image
  where image.hoja_de_ruta_id = v_saved.id
    and (image.image_path like 'blob:%' or image.image_path like 'data:%')
    and image.id = any(v_removed);
  perform set_config('app.allow_legacy_hoja_image_delete', 'off', true);

  insert into public.hoja_de_ruta_images (
    id,
    hoja_de_ruta_id,
    image_path,
    image_type,
    sort_order
  )
  select
    legacy.id,
    v_saved.id,
    legacy.image_path,
    legacy.image_type,
    coalesce(legacy.sort_order, 0)
  from jsonb_to_recordset(v_legacy_images) as legacy(
    id uuid,
    hoja_de_ruta_id uuid,
    image_path text,
    image_type text,
    sort_order integer
  )
  where not (legacy.id = any(v_removed))
  on conflict on constraint hoja_de_ruta_images_pkey do nothing;

  update public.hoja_de_ruta_staff staff
  set department = nullif(btrim(payload_staff.department), '')
  from jsonb_to_recordset(
    coalesce(p_payload -> 'eventData' -> 'staff', '[]'::jsonb)
  ) as payload_staff(id uuid, department text)
  where staff.id = payload_staff.id
    and staff.hoja_de_ruta_id = v_saved.id;

  if v_previous_status = 'approved' then
    update public.hoja_de_ruta h
    set status = 'review',
        approved_by = null,
        approved_at = null,
        review_requested_by = coalesce(auth.uid(), h.review_requested_by)
    where h.id = v_saved.id
      and h.status = 'approved';

    perform public._hoja_log_status_change(
      p_job_id, v_saved.id, 'hoja.status.review', 'approved', 'review',
      jsonb_build_object('reason', 'edited_after_approval')
    );
  elsif v_previous_status = 'review' then
    update public.hoja_de_ruta h
    set review_requested_by = coalesce(auth.uid(), h.review_requested_by)
    where h.id = v_saved.id
      and h.status = 'review';
  end if;

  perform set_config('app.hoja_trusted_write', 'off', true);

  return query select v_saved.id, v_saved.document_version;
end;
$$;
