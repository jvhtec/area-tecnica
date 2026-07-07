-- Rack Builder: row-level security.
-- Unlike the standalone jvhtec/rack-builder project (no auth, fully open
-- anon-key access), this tool is gated to the sound department plus
-- management/admin, matching the existing "sound_job_personnel" pattern:
--   public.current_user_department() = ANY (ARRAY['sound','admin','management'])
--   OR public.is_admin_or_management()
-- (the OR is needed because some management/admin accounts may have a
-- different or null profiles.department value.)

alter table rack_builder_racks enable row level security;
alter table rack_builder_device_categories enable row level security;
alter table rack_builder_devices enable row level security;
alter table rack_builder_projects enable row level security;
alter table rack_builder_layouts enable row level security;
alter table rack_builder_connectors enable row level security;
alter table rack_builder_panel_layouts enable row level security;
alter table rack_builder_panel_layout_rows enable row level security;
alter table rack_builder_panel_layout_ports enable row level security;
alter table rack_builder_layout_items enable row level security;

-- Direct Data API table grants (RLS restricts rows, but PostgREST also
-- requires an explicit table-level grant before it will attempt a query).
revoke all on table rack_builder_racks from public, anon;
grant select, insert, update, delete on table rack_builder_racks to authenticated;
grant all on table rack_builder_racks to service_role;

revoke all on table rack_builder_device_categories from public, anon;
grant select, insert, update, delete on table rack_builder_device_categories to authenticated;
grant all on table rack_builder_device_categories to service_role;

revoke all on table rack_builder_devices from public, anon;
grant select, insert, update, delete on table rack_builder_devices to authenticated;
grant all on table rack_builder_devices to service_role;

revoke all on table rack_builder_projects from public, anon;
grant select, insert, update, delete on table rack_builder_projects to authenticated;
grant all on table rack_builder_projects to service_role;

revoke all on table rack_builder_layouts from public, anon;
grant select, insert, update, delete on table rack_builder_layouts to authenticated;
grant all on table rack_builder_layouts to service_role;

revoke all on table rack_builder_connectors from public, anon;
grant select, insert, update, delete on table rack_builder_connectors to authenticated;
grant all on table rack_builder_connectors to service_role;

revoke all on table rack_builder_panel_layouts from public, anon;
grant select, insert, update, delete on table rack_builder_panel_layouts to authenticated;
grant all on table rack_builder_panel_layouts to service_role;

revoke all on table rack_builder_panel_layout_rows from public, anon;
grant select, insert, update, delete on table rack_builder_panel_layout_rows to authenticated;
grant all on table rack_builder_panel_layout_rows to service_role;

revoke all on table rack_builder_panel_layout_ports from public, anon;
grant select, insert, update, delete on table rack_builder_panel_layout_ports to authenticated;
grant all on table rack_builder_panel_layout_ports to service_role;

revoke all on table rack_builder_layout_items from public, anon;
grant select, insert, update, delete on table rack_builder_layout_items to authenticated;
grant all on table rack_builder_layout_items to service_role;

create policy rack_builder_racks_all on rack_builder_racks
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

create policy rack_builder_device_categories_all on rack_builder_device_categories
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

create policy rack_builder_devices_all on rack_builder_devices
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

create policy rack_builder_projects_all on rack_builder_projects
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

create policy rack_builder_layouts_all on rack_builder_layouts
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

create policy rack_builder_connectors_all on rack_builder_connectors
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

create policy rack_builder_panel_layouts_all on rack_builder_panel_layouts
  for all
  using (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management())
  with check (public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management());

-- Child tables scoped via their parent panel_layout_id (matches how the
-- source project scoped these via project_id, just with real gating now).
create policy rack_builder_panel_layout_rows_all on rack_builder_panel_layout_rows
  for all
  using (
    public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management()
  )
  with check (
    public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management()
  );

create policy rack_builder_panel_layout_ports_all on rack_builder_panel_layout_ports
  for all
  using (
    public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management()
  )
  with check (
    public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management()
  );

create policy rack_builder_layout_items_all on rack_builder_layout_items
  for all
  using (
    public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management()
  )
  with check (
    public.current_user_department() = ANY (ARRAY['sound','admin','management']) OR public.is_admin_or_management()
  );
