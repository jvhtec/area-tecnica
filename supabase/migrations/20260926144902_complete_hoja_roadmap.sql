-- Complete the remaining Hoja de Ruta persistence and authorization roadmap.
-- This is intentionally forward-only: PR #957's merged migration remains immutable.

alter table public.hoja_de_ruta_staff
  add column if not exists department text;

comment on column public.hoja_de_ruta_staff.department is
  'Persisted department used for deterministic Hoja de Ruta staff grouping.';

create index if not exists idx_hoja_transport_source_logistics_event_id
  on public.hoja_de_ruta_transport(source_logistics_event_id)
  where source_logistics_event_id is not null;

-- Trigger functions execute through their trigger and do not need an exposed
-- PostgREST EXECUTE grant.
revoke all on function public.update_hoja_de_ruta_last_modified()
  from public, anon, authenticated;

-- Keep the job parameter meaningful so the same helper can be used by RPCs and
-- row policies. The role comes from trusted profile data; service-role access is
-- read from the signed JWT claim rather than deprecated auth.role().
create or replace function public.can_manage_hoja(p_job_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or coalesce(public.get_current_user_role(), '') in ('admin', 'management', 'logistics')
  ) and (
    p_job_id is null
    or exists (select 1 from public.jobs j where j.id = p_job_id)
  );
$$;

revoke all on function public.can_manage_hoja(uuid) from public, anon;
grant execute on function public.can_manage_hoja(uuid) to authenticated, service_role;

create or replace function public.can_manage_hoja_record(p_hoja_de_ruta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select public.can_manage_hoja(h.job_id)
    from public.hoja_de_ruta h
    where h.id = p_hoja_de_ruta_id
  ), false);
$$;

revoke all on function public.can_manage_hoja_record(uuid) from public, anon;
grant execute on function public.can_manage_hoja_record(uuid) to authenticated, service_role;

create or replace function public.can_manage_hoja_accommodation(p_accommodation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select public.can_manage_hoja_record(a.hoja_de_ruta_id)
    from public.hoja_de_ruta_accommodations a
    where a.id = p_accommodation_id
  ), false);
$$;

revoke all on function public.can_manage_hoja_accommodation(uuid) from public, anon;
grant execute on function public.can_manage_hoja_accommodation(uuid) to authenticated, service_role;

-- Cached clients still call the three-argument save RPC and do not know about
-- explicit image removals. Prevent that compatibility path from deleting
-- unrecoverable transient rows. The current four-argument RPC opts in only for
-- the exact legacy IDs the user explicitly removed.
create or replace function public.preserve_legacy_hoja_image_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (old.image_path like 'blob:%' or old.image_path like 'data:%')
     and coalesce(current_setting('app.allow_legacy_hoja_image_delete', true), '') <> 'on' then
    return null;
  end if;
  return old;
end;
$$;

revoke all on function public.preserve_legacy_hoja_image_delete()
  from public, anon, authenticated;

drop trigger if exists preserve_legacy_hoja_image_delete
  on public.hoja_de_ruta_images;
create trigger preserve_legacy_hoja_image_delete
before delete on public.hoja_de_ruta_images
for each row execute function public.preserve_legacy_hoja_image_delete();

-- The three-argument save RPC from PR #957 remains the compatibility core.
-- This overload adds explicit image deletion and post-save department updates.
-- Invalid legacy image paths are restored after the compatibility save unless
-- the caller explicitly identifies them for removal.
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
begin
  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    into v_legacy_images
  from public.hoja_de_ruta h
  join public.hoja_de_ruta_images i on i.hoja_de_ruta_id = h.id
  where h.job_id = p_job_id
    and (i.image_path like 'blob:%' or i.image_path like 'data:%');

  select saved.id, saved.document_version
    into v_saved
  from public.save_hoja_de_ruta(p_job_id, p_expected_version, p_payload) saved;

  perform set_config('app.allow_legacy_hoja_image_delete', 'on', true);
  delete from public.hoja_de_ruta_images image
  where image.hoja_de_ruta_id = v_saved.id
    and (image.image_path like 'blob:%' or image.image_path like 'data:%')
    and image.id = any(
      coalesce(array_remove(p_removed_image_ids, null), '{}'::uuid[])
    );
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
  where not (
    legacy.id = any(
      coalesce(array_remove(p_removed_image_ids, null), '{}'::uuid[])
    )
  )
  on conflict on constraint hoja_de_ruta_images_pkey do nothing;

  update public.hoja_de_ruta_staff staff
  set department = nullif(btrim(payload_staff.department), '')
  from jsonb_to_recordset(
    coalesce(p_payload -> 'eventData' -> 'staff', '[]'::jsonb)
  ) as payload_staff(id uuid, department text)
  where staff.id = payload_staff.id
    and staff.hoja_de_ruta_id = v_saved.id;

  return query select v_saved.id, v_saved.document_version;
end;
$$;

revoke all on function public.save_hoja_de_ruta(uuid, integer, jsonb, uuid[])
  from public, anon;
grant execute on function public.save_hoja_de_ruta(uuid, integer, jsonb, uuid[])
  to authenticated, service_role;

-- Version-aware overloads close the realtime race between a client's final
-- conflict check and status/publication mutations. Their existing two-argument
-- counterparts remain available only as implementation cores for this
-- forward-only migration.
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
begin
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

  return query
  select transition.status,
         transition.approved_by,
         transition.approved_at,
         transition.document_version
  from public.set_hoja_de_ruta_status(p_job_id, p_status) transition;
end;
$$;

revoke all on function public.set_hoja_de_ruta_status(uuid, text, integer)
  from public, anon;
grant execute on function public.set_hoja_de_ruta_status(uuid, text, integer)
  to authenticated, service_role;

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
begin
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

  return public.publish_hoja_de_ruta_document(p_job_id, p_document_id);
end;
$$;

revoke all on function public.publish_hoja_de_ruta_document(uuid, uuid, integer)
  from public, anon;
grant execute on function public.publish_hoja_de_ruta_document(uuid, uuid, integer)
  to authenticated, service_role;

-- The old status/publication signatures cannot provide optimistic concurrency.
-- Force interactive clients onto the version-aware overloads; the wrappers can
-- still invoke the implementation cores as their security-definer owner.
revoke execute on function public.set_hoja_de_ruta_status(uuid, text)
  from authenticated;
revoke execute on function public.publish_hoja_de_ruta_document(uuid, uuid)
  from authenticated;

create or replace function public.migrate_hoja_legacy_image_path(
  p_image_id uuid,
  p_expected_path text,
  p_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if (p_expected_path not like 'data:%' and p_expected_path not like 'blob:%')
     or p_storage_path like 'data:%'
     or p_storage_path like 'blob:%'
     or p_storage_path not like 'hojas-de-ruta/%' then
    raise exception 'invalid Hoja image migration path' using errcode = '22023';
  end if;

  update public.hoja_de_ruta_images
  set image_path = p_storage_path
  where id = p_image_id
    and image_path = p_expected_path;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.migrate_hoja_legacy_image_path(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.migrate_hoja_legacy_image_path(uuid, text, text)
  to service_role;

-- Remove every historical policy on Hoja aggregate tables before installing a
-- single policy model. Technicians consume the restricted aggregate RPC; direct
-- table access is reserved for Hoja managers and existing Tour Ops management.
do $policy_cleanup$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'hoja_de_ruta',
    'hoja_de_ruta_accommodations',
    'hoja_de_ruta_contacts',
    'hoja_de_ruta_equipment',
    'hoja_de_ruta_images',
    'hoja_de_ruta_logistics',
    'hoja_de_ruta_restaurants',
    'hoja_de_ruta_room_assignments',
    'hoja_de_ruta_rooms',
    'hoja_de_ruta_staff',
    'hoja_de_ruta_templates',
    'hoja_de_ruta_transport',
    'hoja_de_ruta_travel',
    'hoja_de_ruta_travel_arrangements'
  ]
  loop
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;
  end loop;
end;
$policy_cleanup$;

create policy hoja_manage_main
on public.hoja_de_ruta
for all
to authenticated
using (public.can_manage_hoja(job_id))
with check (public.can_manage_hoja(job_id));

create policy hoja_manage_accommodations
on public.hoja_de_ruta_accommodations
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_manage_contacts
on public.hoja_de_ruta_contacts
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_manage_images
on public.hoja_de_ruta_images
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_manage_logistics
on public.hoja_de_ruta_logistics
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_manage_room_assignments
on public.hoja_de_ruta_room_assignments
for all
to authenticated
using (public.can_manage_hoja_accommodation(accommodation_id))
with check (public.can_manage_hoja_accommodation(accommodation_id));

create policy hoja_manage_staff
on public.hoja_de_ruta_staff
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_manage_transport
on public.hoja_de_ruta_transport
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_manage_travel_arrangements
on public.hoja_de_ruta_travel_arrangements
for all
to authenticated
using (public.can_manage_hoja_record(hoja_de_ruta_id))
with check (public.can_manage_hoja_record(hoja_de_ruta_id));

create policy hoja_templates_read_active
on public.hoja_de_ruta_templates
for select
to authenticated
using (is_active or public.can_manage_hoja(null));

create policy hoja_templates_insert_managers
on public.hoja_de_ruta_templates
for insert
to authenticated
with check (public.can_manage_hoja(null));

create policy hoja_templates_update_managers
on public.hoja_de_ruta_templates
for update
to authenticated
using (public.can_manage_hoja(null))
with check (public.can_manage_hoja(null));

create policy hoja_templates_delete_managers
on public.hoja_de_ruta_templates
for delete
to authenticated
using (public.can_manage_hoja(null));

revoke all on table
  public.hoja_de_ruta,
  public.hoja_de_ruta_accommodations,
  public.hoja_de_ruta_contacts,
  public.hoja_de_ruta_equipment,
  public.hoja_de_ruta_images,
  public.hoja_de_ruta_logistics,
  public.hoja_de_ruta_restaurants,
  public.hoja_de_ruta_room_assignments,
  public.hoja_de_ruta_rooms,
  public.hoja_de_ruta_staff,
  public.hoja_de_ruta_templates,
  public.hoja_de_ruta_transport,
  public.hoja_de_ruta_travel,
  public.hoja_de_ruta_travel_arrangements
from anon;

revoke all on table
  public.hoja_de_ruta_equipment,
  public.hoja_de_ruta_restaurants,
  public.hoja_de_ruta_rooms,
  public.hoja_de_ruta_travel
from authenticated;

grant select, insert, update, delete on table
  public.hoja_de_ruta,
  public.hoja_de_ruta_accommodations,
  public.hoja_de_ruta_contacts,
  public.hoja_de_ruta_images,
  public.hoja_de_ruta_logistics,
  public.hoja_de_ruta_room_assignments,
  public.hoja_de_ruta_staff,
  public.hoja_de_ruta_templates,
  public.hoja_de_ruta_transport,
  public.hoja_de_ruta_travel_arrangements
to authenticated;

comment on table public.hoja_de_ruta_equipment is
  'RETIRED: equipment is represented by canonical job/equipment domains; no client access.';
comment on table public.hoja_de_ruta_restaurants is
  'RETIRED: restaurants persist in hoja_de_ruta.restaurants_info for aggregate compatibility.';
comment on table public.hoja_de_ruta_rooms is
  'RETIRED: use hoja_de_ruta_accommodations plus hoja_de_ruta_room_assignments.';
comment on table public.hoja_de_ruta_travel is
  'RETIRED: use hoja_de_ruta_travel_arrangements.';
