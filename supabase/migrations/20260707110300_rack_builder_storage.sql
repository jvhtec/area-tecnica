-- Rack Builder: storage buckets for device/connector images.
-- Buckets stay public=true, same as the standalone project (device photos
-- and connector icon SVGs are non-sensitive, matching that project's own
-- security notes) -- this keeps getPublicUrl usable synchronously across
-- the drag-and-drop palette/canvas and PDF export code paths, which would
-- otherwise need a risky rewrite to async signed URLs. Writes (insert/
-- update/delete) are still gated to sound department + management/admin
-- via RLS below, unlike the standalone project's fully-open anon access.

insert into storage.buckets (id, name, public)
values
  ('rack-builder-device-images', 'rack-builder-device-images', true),
  ('rack-builder-connector-images', 'rack-builder-connector-images', true)
on conflict (id) do nothing;

create policy rack_builder_device_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rack-builder-device-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_device_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rack-builder-device-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_device_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'rack-builder-device-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_device_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rack-builder-device-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_connector_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rack-builder-connector-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_connector_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rack-builder-connector-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_connector_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'rack-builder-connector-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );

create policy rack_builder_connector_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rack-builder-connector-images'
    and (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  );
