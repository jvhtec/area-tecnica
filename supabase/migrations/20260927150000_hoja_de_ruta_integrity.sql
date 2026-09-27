-- Hoja de Ruta integrity: close the post-roadmap audit
-- (docs/hoja-de-ruta-post-roadmap-audit-2026-09-27.md).
--
-- * Every write path, not only the aggregate RPCs, now respects the final lock
--   and moves document_version, so an open editor can never silently overwrite
--   a Tour Ops or crew-removal change (H1).
-- * Workflow columns change only through the workflow RPCs (H1).
-- * Content edits to an approved document send it back to review; approval
--   needs a second person; management can reopen with a logged reason (M2).
-- * The editor's realtime listeners have a publication to listen to (H2).
-- * Staff departments and technician links are backfilled (H3).
-- * DNI copies are purged after the event (M4).
-- * Compatibility RPCs are retired and wrappers authorize first (M5, M6).
-- * Technicians only see approved/final/published content; publication makes
--   the PDF visible to crew atomically; dry-hire jobs cannot get a Hoja (L2).

-- ---------------------------------------------------------------------------
-- Trusted-write marker
-- ---------------------------------------------------------------------------
-- The aggregate/workflow RPCs set this transaction-local flag while they write.
-- Direct PostgREST writes can never set it: set_config is not exposed and each
-- request is a single statement.

create or replace function public._hoja_trusted_write()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('app.hoja_trusted_write', true), '') = 'on';
$$;

revoke all on function public._hoja_trusted_write() from public, anon, authenticated;

create or replace function public._hoja_is_service_role()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  -- Only the signed JWT counts. Inside SECURITY DEFINER code current_user is
  -- the function owner, so it cannot distinguish trusted callers.
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

revoke all on function public._hoja_is_service_role() from public, anon, authenticated;

alter table public.hoja_de_ruta
  add column if not exists review_requested_by uuid
    references auth.users(id) on delete set null;

comment on column public.hoja_de_ruta.review_requested_by is
  'User who sent the Hoja to review. Approval must come from someone else (admins exempt).';

-- ---------------------------------------------------------------------------
-- Status-change activity helper
-- ---------------------------------------------------------------------------

insert into public.activity_catalog (
  code,
  default_visibility,
  label,
  severity,
  template,
  toast_enabled
)
values (
  'hoja.status.reopened',
  'management'::public.activity_visibility,
  'Hoja de Ruta reabierta',
  'warn',
  null,
  true
)
on conflict (code) do update
set
  default_visibility = excluded.default_visibility,
  label = excluded.label,
  severity = excluded.severity,
  template = excluded.template,
  toast_enabled = excluded.toast_enabled;

create or replace function public._hoja_log_status_change(
  p_job_id uuid,
  p_hoja_id uuid,
  p_code text,
  p_from text,
  p_to text,
  p_extra jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  if v_actor is null then
    return;
  end if;

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '')
    into v_actor_name
  from public.profiles p
  where p.id = v_actor;

  insert into public.activity_log (
    code,
    job_id,
    actor_id,
    actor_name,
    entity_type,
    entity_id,
    visibility,
    payload
  )
  values (
    p_code,
    p_job_id,
    v_actor,
    v_actor_name,
    'hoja_de_ruta',
    p_hoja_id,
    coalesce(
      (select c.default_visibility from public.activity_catalog c where c.code = p_code),
      'management'::public.activity_visibility
    ),
    jsonb_build_object('from', p_from, 'to', p_to) || coalesce(p_extra, '{}'::jsonb)
  );
end;
$$;

revoke all on function public._hoja_log_status_change(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Version bump shared by every non-aggregate writer
-- ---------------------------------------------------------------------------
-- One bump per Hoja per client statement is enough for optimistic concurrency
-- and keeps multi-row statements (and the cascades they trigger) from producing
-- an update storm. Nested statements share the client statement timestamp. An approved
-- document that changes goes back to review.

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

revoke all on function public._hoja_touch(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Parent guard
-- ---------------------------------------------------------------------------

create or replace function public.hoja_de_ruta_guard()
returns trigger
language plpgsql
-- Definer rights so the trigger can use the revoked integrity helpers; the
-- decision itself only reads the signed JWT and the trigger depth.
security definer
set search_path = public, pg_temp
as $$
declare
  v_ignored constant text[] := array[
    'published_document_id', 'approved_by', 'created_by',
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

  -- UPDATE by a non-aggregate writer.
  v_old_content := to_jsonb(old) - v_ignored;
  v_new_content := to_jsonb(new) - v_ignored;

  -- Nothing editorial changed: a no-op update, or a referential action such as
  -- ON DELETE SET NULL clearing a deleted document or user. Referential
  -- actions run as nested triggers and must never be blocked.
  if v_old_content = v_new_content
     and (
       not v_top_level
       or (
         new.published_document_id is not distinct from old.published_document_id
         and new.approved_by is not distinct from old.approved_by
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
  end if;
  new.last_modified := now();
  new.updated_at := now();

  -- Mark this statement so child writes it cascades into do not bump again.
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

revoke all on function public.hoja_de_ruta_guard() from public, anon, authenticated;

drop trigger if exists hoja_de_ruta_guard on public.hoja_de_ruta;
create trigger hoja_de_ruta_guard
before insert or update or delete on public.hoja_de_ruta
for each row execute function public.hoja_de_ruta_guard();

-- ---------------------------------------------------------------------------
-- Child guard
-- ---------------------------------------------------------------------------

create or replace function public._hoja_guard_child_hoja(p_hoja_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if p_hoja_id is null then
    return;
  end if;

  select coalesce(h.status, 'draft') into v_status
  from public.hoja_de_ruta h
  where h.id = p_hoja_id;

  -- The parent is being deleted (cascade) or never existed.
  if not found then
    return;
  end if;

  -- Enforce on top-level statements only: referential actions (a deleted
  -- profile or tour date) and cleanup triggers run nested and are not edits.
  if v_status = 'final'
     and pg_trigger_depth() = 1
     and not public._hoja_is_service_role() then
    raise exception 'La Hoja de Ruta está finalizada y no admite edición'
      using errcode = '22023';
  end if;

  perform public._hoja_touch(p_hoja_id);
end;
$$;

revoke all on function public._hoja_guard_child_hoja(uuid) from public, anon, authenticated;

create or replace function public.hoja_de_ruta_child_guard()
returns trigger
language plpgsql
-- Definer rights so the trigger can use the revoked integrity helpers; the
-- decision itself only reads the signed JWT and the trigger depth.
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_hoja uuid;
  v_new_hoja uuid;
begin
  if public._hoja_trusted_write() then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'hoja_de_ruta_room_assignments' then
    if tg_op <> 'INSERT' then
      select a.hoja_de_ruta_id into v_old_hoja
      from public.hoja_de_ruta_accommodations a
      where a.id = old.accommodation_id;
    end if;
    if tg_op <> 'DELETE' then
      select a.hoja_de_ruta_id into v_new_hoja
      from public.hoja_de_ruta_accommodations a
      where a.id = new.accommodation_id;
    end if;
  else
    if tg_op <> 'INSERT' then
      v_old_hoja := (to_jsonb(old) ->> 'hoja_de_ruta_id')::uuid;
    end if;
    if tg_op <> 'DELETE' then
      v_new_hoja := (to_jsonb(new) ->> 'hoja_de_ruta_id')::uuid;
    end if;
  end if;

  perform public._hoja_guard_child_hoja(v_old_hoja);
  if v_new_hoja is distinct from v_old_hoja then
    perform public._hoja_guard_child_hoja(v_new_hoja);
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.hoja_de_ruta_child_guard() from public, anon, authenticated;

do $child_guards$
declare
  v_table text;
begin
  foreach v_table in array array[
    'hoja_de_ruta_accommodations',
    'hoja_de_ruta_contacts',
    'hoja_de_ruta_images',
    'hoja_de_ruta_logistics',
    'hoja_de_ruta_room_assignments',
    'hoja_de_ruta_staff',
    'hoja_de_ruta_transport',
    'hoja_de_ruta_travel_arrangements'
  ]
  loop
    -- The name sorts after preserve_legacy_hoja_image_delete so a suppressed
    -- legacy image delete never counts as an edit.
    execute format('drop trigger if exists trg_hoja_child_guard on public.%I', v_table);
    execute format(
      'create trigger trg_hoja_child_guard before insert or update or delete on public.%I
         for each row execute function public.hoja_de_ruta_child_guard()',
      v_table
    );
  end loop;
end;
$child_guards$;

-- ---------------------------------------------------------------------------
-- Crew removal keeps final documents intact and never matches by name
-- ---------------------------------------------------------------------------

create or replace function public.remove_assignment_with_timesheets(
  p_job_id uuid,
  p_technician_id uuid
)
returns table(deleted_timesheets integer, deleted_assignment boolean)
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_deleted_timesheets int := 0;
  v_assignment_rows int := 0;
  v_deleted_assignment boolean := false;
begin
  if not (auth.role() = 'service_role' or public.is_admin_or_management()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from public.timesheets
  where job_id = p_job_id
    and technician_id = p_technician_id;

  get diagnostics v_deleted_timesheets = row_count;

  delete from public.job_assignments
  where job_id = p_job_id
    and technician_id = p_technician_id;

  get diagnostics v_assignment_rows = row_count;
  v_deleted_assignment := v_assignment_rows > 0;

  -- Remove the technician's auto-linked Hoja rows. A final Hoja is a signed-off
  -- record and stays as issued; its guard would reject the change anyway.
  if v_deleted_assignment then
    delete from public.hoja_de_ruta_staff s
    using public.hoja_de_ruta h
    where h.job_id = p_job_id
      and s.hoja_de_ruta_id = h.id
      and coalesce(h.status, 'draft') <> 'final'
      and s.technician_id = p_technician_id;

    delete from public.hoja_de_ruta_contacts c
    using public.hoja_de_ruta h
    where h.job_id = p_job_id
      and c.hoja_de_ruta_id = h.id
      and coalesce(h.status, 'draft') <> 'final'
      and c.technician_id = p_technician_id;
  end if;

  return query select v_deleted_timesheets, v_deleted_assignment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aggregate save wrapper (authorize first, trusted write, review reset)
-- ---------------------------------------------------------------------------

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

  -- Restore omitted legacy rows the core deleted as absent from the payload,
  -- unless the editor removed them explicitly. A data: row the editor
  -- re-uploaded arrives with the same ID and a storage path, so it conflicts.
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

  -- Editing approved content invalidates the approval.
  if v_previous_status = 'approved' then
    update public.hoja_de_ruta h
    set status = 'review',
        approved_by = null,
        approved_at = null
    where h.id = v_saved.id
      and h.status = 'approved';

    perform public._hoja_log_status_change(
      p_job_id, v_saved.id, 'hoja.status.review', 'approved', 'review',
      jsonb_build_object('reason', 'edited_after_approval')
    );
  end if;

  perform set_config('app.hoja_trusted_write', 'off', true);

  return query select v_saved.id, v_saved.document_version;
end;
$$;

revoke all on function public.save_hoja_de_ruta(uuid, integer, jsonb, uuid[])
  from public, anon;
grant execute on function public.save_hoja_de_ruta(uuid, integer, jsonb, uuid[])
  to authenticated, service_role;

-- The three-argument core stays as the wrapper's implementation only.
revoke execute on function public.save_hoja_de_ruta(uuid, integer, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Status wrapper (authorize first, four-eyes approval)
-- ---------------------------------------------------------------------------

create or replace function public.set_hoja_de_ruta_status(
  p_job_id uuid,
  p_status text,
  p_expected_version integer
)
returns table(status text, approved_by uuid, approved_at timestamptz, document_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_version integer;
  v_current_status text;
  v_review_requested_by uuid;
  v_actor uuid := auth.uid();
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select coalesce(h.document_version, 0), coalesce(h.status, 'draft'), h.review_requested_by
    into v_current_version, v_current_status, v_review_requested_by
  from public.hoja_de_ruta h
  where h.job_id = p_job_id
  for update;

  if not found then
    raise exception 'No existe una Hoja de Ruta para este trabajo' using errcode = '22023';
  end if;

  if v_current_version <> coalesce(p_expected_version, 0) then
    raise exception 'La Hoja de Ruta ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  if p_status = 'approved'
     and v_current_status = 'review'
     and v_actor is not null
     and v_review_requested_by = v_actor
     and coalesce(public.get_current_user_role(), '') <> 'admin' then
    raise exception 'Otra persona debe aprobar la Hoja de Ruta que enviaste a revisión'
      using errcode = '42501';
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);

  return query
  select transition.status,
         transition.approved_by,
         transition.approved_at,
         transition.document_version
  from public.set_hoja_de_ruta_status(p_job_id, p_status) transition;

  if p_status = 'review' and v_current_status = 'draft' then
    update public.hoja_de_ruta h
    set review_requested_by = v_actor
    where h.job_id = p_job_id;
  end if;

  perform set_config('app.hoja_trusted_write', 'off', true);
end;
$$;

revoke all on function public.set_hoja_de_ruta_status(uuid, text, integer)
  from public, anon;
grant execute on function public.set_hoja_de_ruta_status(uuid, text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reopen (management only, logged, versioned)
-- ---------------------------------------------------------------------------

create or replace function public.reopen_hoja_de_ruta(
  p_job_id uuid,
  p_expected_version integer,
  p_reason text
)
returns table(status text, document_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoja_id uuid;
  v_current_status text;
  v_current_version integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.can_manage_hoja(p_job_id)
     or (
       coalesce(public.get_current_user_role(), '') not in ('admin', 'management')
       and not public._hoja_is_service_role()
     ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Indica el motivo para reabrir la Hoja de Ruta' using errcode = '22023';
  end if;

  select h.id, coalesce(h.status, 'draft'), coalesce(h.document_version, 0)
    into v_hoja_id, v_current_status, v_current_version
  from public.hoja_de_ruta h
  where h.job_id = p_job_id
  for update;

  if not found then
    raise exception 'No existe una Hoja de Ruta para este trabajo' using errcode = '22023';
  end if;

  if v_current_version <> coalesce(p_expected_version, 0) then
    raise exception 'La Hoja de Ruta ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  if v_current_status not in ('approved', 'final') then
    raise exception 'Solo se puede reabrir una Hoja de Ruta aprobada o finalizada'
      using errcode = '22023';
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);

  update public.hoja_de_ruta h
  set
    status = 'draft',
    approved_by = null,
    approved_at = null,
    review_requested_by = null,
    document_version = coalesce(h.document_version, 0) + 1,
    last_modified = now(),
    last_modified_by = auth.uid(),
    updated_at = now()
  where h.id = v_hoja_id;

  perform set_config('app.hoja_trusted_write', 'off', true);

  perform public._hoja_log_status_change(
    p_job_id, v_hoja_id, 'hoja.status.reopened', v_current_status, 'draft',
    jsonb_build_object('reason', v_reason)
  );

  return query
  select h.status, h.document_version
  from public.hoja_de_ruta h
  where h.id = v_hoja_id;
end;
$$;

revoke all on function public.reopen_hoja_de_ruta(uuid, integer, text) from public, anon;
grant execute on function public.reopen_hoja_de_ruta(uuid, integer, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Publication wrapper (authorize first, crew visibility is atomic)
-- ---------------------------------------------------------------------------

create or replace function public.publish_hoja_de_ruta_document(
  p_job_id uuid,
  p_document_id uuid,
  p_expected_version integer
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_version integer;
  v_retired text[];
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select coalesce(h.document_version, 0)
    into v_current_version
  from public.hoja_de_ruta h
  where h.job_id = p_job_id
  for update;

  if not found then
    raise exception 'No existe una Hoja de Ruta para este trabajo' using errcode = '22023';
  end if;

  if v_current_version <> coalesce(p_expected_version, 0) then
    raise exception 'La Hoja de Ruta ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);
  v_retired := public.publish_hoja_de_ruta_document(p_job_id, p_document_id);

  -- The client uploads the PDF hidden; it becomes crew-visible only once it is
  -- the canonical published document.
  update public.job_documents jd
  set visible_to_tech = true
  where jd.id = p_document_id
    and jd.job_id = p_job_id;

  perform set_config('app.hoja_trusted_write', 'off', true);

  return v_retired;
end;
$$;

revoke all on function public.publish_hoja_de_ruta_document(uuid, uuid, integer)
  from public, anon;
grant execute on function public.publish_hoja_de_ruta_document(uuid, uuid, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Aggregate read: signed JWT role, crew sees only approved/published content
-- ---------------------------------------------------------------------------

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
           or h.published_document_id is not null
    into v_hoja_id, v_crew_visible
  from public.hoja_de_ruta h
  where h.job_id = p_job_id;

  if v_hoja_id is null then
    return null;
  end if;

  -- Crew never reads work in progress.
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
                  'staff_member1_id', (
                    select s1.technician_id
                    from public.hoja_de_ruta_staff s1
                    where s1.id = r.staff_member1_hoja_staff_id
                      and s1.hoja_de_ruta_id = h.id
                  ),
                  'staff_member1_name', (
                    select nullif(btrim(concat_ws(' ', s1.name, s1.surname1, s1.surname2)), '')
                    from public.hoja_de_ruta_staff s1
                    where s1.id = r.staff_member1_hoja_staff_id
                      and s1.hoja_de_ruta_id = h.id
                  ),
                  'staff_member2_id', (
                    select s2.technician_id
                    from public.hoja_de_ruta_staff s2
                    where s2.id = r.staff_member2_hoja_staff_id
                      and s2.hoja_de_ruta_id = h.id
                  ),
                  'staff_member2_name', (
                    select nullif(btrim(concat_ws(' ', s2.name, s2.surname1, s2.surname2)), '')
                    from public.hoja_de_ruta_staff s2
                    where s2.id = r.staff_member2_hoja_staff_id
                      and s2.hoja_de_ruta_id = h.id
                  )
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

revoke all on function public.get_hoja_de_ruta(uuid) from public, anon;
grant execute on function public.get_hoja_de_ruta(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Retire compatibility RPCs (M5)
-- ---------------------------------------------------------------------------
-- No shipped client calls these any more. replace_hoja_de_ruta_all had no
-- expected version and regenerated child IDs.

drop function if exists public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb);
drop function if exists public.replace_hoja_de_ruta_transport(uuid, jsonb);
drop function if exists public.replace_hoja_de_ruta_contacts(uuid, jsonb);
drop function if exists public.replace_hoja_de_ruta_staff(uuid, jsonb);

-- Trigger functions are never PostgREST entry points.
revoke all on function public.trg_log_hoja_update() from public, anon, authenticated;
revoke all on function public.preserve_legacy_hoja_image_delete() from public, anon, authenticated;
revoke all on function public.clear_legacy_hoja_room_staff_references() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- DNI retention (M4)
-- ---------------------------------------------------------------------------
-- The accreditation export needs DNI around the event. Thirty days after the
-- job ends the Hoja copy is cleared; profiles keep the canonical value.

create or replace function public.purge_expired_hoja_dni(
  p_retention interval default interval '30 days'
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_purged integer;
begin
  -- Invoker rights: only service_role (API) and the cron owner hold EXECUTE.
  -- A retention purge is not an editorial change: no version bump, and final
  -- documents are cleared too.
  perform set_config('app.hoja_trusted_write', 'on', true);

  update public.hoja_de_ruta_staff s
  set dni = null
  from public.hoja_de_ruta h
  join public.jobs j on j.id = h.job_id
  where s.hoja_de_ruta_id = h.id
    and nullif(btrim(s.dni), '') is not null
    and coalesce(j.end_time, j.start_time) < now() - p_retention;

  get diagnostics v_purged = row_count;

  perform set_config('app.hoja_trusted_write', 'off', true);
  return v_purged;
end;
$$;

revoke all on function public.purge_expired_hoja_dni(interval) from public, anon, authenticated;
grant execute on function public.purge_expired_hoja_dni(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (
       select 1 from cron.job where jobname = 'purge-expired-hoja-dni'
     ) then
    perform cron.schedule(
      'purge-expired-hoja-dni',
      '23 3 * * *',
      'select public.purge_expired_hoja_dni();'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime publication (H2)
-- ---------------------------------------------------------------------------
-- RLS still applies to realtime: only Hoja managers receive hoja_de_ruta rows.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'hoja_de_ruta'
    ) then
      alter publication supabase_realtime add table public.hoja_de_ruta;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'power_requirement_tables'
    ) then
      alter publication supabase_realtime add table public.power_requirement_tables;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfills (H3). Trusted: data repair is not an editorial change.
-- ---------------------------------------------------------------------------

do $backfill$
begin
  perform set_config('app.hoja_trusted_write', 'on', true);

  -- Link legacy staff rows to the technician assigned to the same job when the
  -- name matches exactly one assignment. Crew removal no longer matches by name.
  with candidates as (
    select s.id as staff_id, min(ja.technician_id::text)::uuid as technician_id,
           count(distinct ja.technician_id) as matches
    from public.hoja_de_ruta_staff s
    join public.hoja_de_ruta h on h.id = s.hoja_de_ruta_id
    join public.job_assignments ja on ja.job_id = h.job_id
    join public.profiles p on p.id = ja.technician_id
    where s.technician_id is null
      and lower(btrim(coalesce(s.name, ''))) = lower(btrim(coalesce(p.first_name, '')))
      and lower(btrim(coalesce(s.surname1, ''))) = lower(btrim(coalesce(p.last_name, '')))
      and btrim(coalesce(s.name, '')) <> ''
    group by s.id
  )
  update public.hoja_de_ruta_staff s
  set technician_id = c.technician_id
  from candidates c
  where c.staff_id = s.id
    and c.matches = 1;

  update public.hoja_de_ruta_staff s
  set department = nullif(btrim(p.department::text), '')
  from public.profiles p
  where s.technician_id = p.id
    and s.department is null
    and nullif(btrim(p.department::text), '') is not null;

  perform set_config('app.hoja_trusted_write', 'off', true);
end;
$backfill$;
