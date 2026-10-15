-- Supabase performance advisor: duplicate_index and unindexed_foreign_keys.
--
-- Duplicate indexes double the write cost of every insert/update on their
-- table for no read benefit (they come from unnamed `create index` statements
-- that ran more than once). Keep the first copy, drop the rest.
--
-- Foreign keys without a covering index force a sequential scan of the
-- referencing table whenever the referenced row is deleted or its key
-- changes (e.g. deleting a profile scans every *_by column). All tables
-- here are small, so plain CREATE INDEX is fine.

drop index if exists public.festival_artist_files_uploaded_at_idx1;
drop index if exists public.logistics_event_departments_event_id_idx1;
drop index if exists public.push_notification_routes_event_code_idx1;
drop index if exists public.push_notification_routes_event_code_idx2;
drop index if exists public.skills_category_idx1;
drop index if exists public.skills_category_idx2;
drop index if exists public.timesheets_is_active_idx1;

create index if not exists idx_achievement_unlocks_achievement_id on public.achievement_unlocks (achievement_id);
create index if not exists idx_administrative_job_tasks_completed_by on public.administrative_job_tasks (completed_by);
create index if not exists idx_administrative_job_tasks_job_id on public.administrative_job_tasks (job_id);
create index if not exists idx_administrative_job_tasks_tour_id on public.administrative_job_tasks (tour_id);
create index if not exists idx_flex_provisioning_nodes_tracking_row_id on public.flex_provisioning_nodes (tracking_row_id);
create index if not exists idx_flex_provisioning_operations_requested_by on public.flex_provisioning_operations (requested_by);
create index if not exists idx_hoja_de_ruta_review_requested_by on public.hoja_de_ruta (review_requested_by);
create index if not exists idx_job_project_notes_created_by on public.job_project_notes (created_by);
create index if not exists idx_job_project_notes_updated_by on public.job_project_notes (updated_by);
create index if not exists idx_job_rehearsal_dates_created_by on public.job_rehearsal_dates (created_by);
create index if not exists idx_job_stage_plots_created_by on public.job_stage_plots (created_by);
create index if not exists idx_job_technician_rate_mode_dates_created_by on public.job_technician_rate_mode_dates (created_by);
create index if not exists idx_job_technician_rate_mode_dates_technician_id on public.job_technician_rate_mode_dates (technician_id);
create index if not exists idx_job_technician_rate_mode_dates_updated_by on public.job_technician_rate_mode_dates (updated_by);
create index if not exists idx_jobs_preventive_resource_assigned_by on public.jobs (preventive_resource_assigned_by);
create index if not exists idx_production_job_tasks_completed_by on public.production_job_tasks (completed_by);
create index if not exists idx_production_job_tasks_job_id on public.production_job_tasks (job_id);
create index if not exists idx_production_job_tasks_tour_id on public.production_job_tasks (tour_id);
create index if not exists idx_rack_builder_panel_layout_ports_panel_layout_id_row_index on public.rack_builder_panel_layout_ports (panel_layout_id, row_index);
create index if not exists idx_staffing_campaigns_created_by on public.staffing_campaigns (created_by);
create index if not exists idx_tour_guest_links_created_by on public.tour_guest_links (created_by);
create index if not exists idx_transport_requests_subrental_id_job_id_department on public.transport_requests (subrental_id, job_id, department);
create index if not exists idx_truck_planner_bundle_rules_case_sku_id on public.truck_planner_bundle_rules (case_sku_id);
create index if not exists idx_truck_planner_bundle_rules_equipment_id on public.truck_planner_bundle_rules (equipment_id);
create index if not exists idx_truck_planner_bundle_versions_created_by on public.truck_planner_bundle_versions (created_by);
create index if not exists idx_truck_planner_job_plans_created_by on public.truck_planner_job_plans (created_by);
create index if not exists idx_truck_planner_job_plans_updated_by on public.truck_planner_job_plans (updated_by);
create index if not exists idx_truck_planner_plan_case_counts_case_sku_id on public.truck_planner_plan_case_counts (case_sku_id);
create index if not exists idx_truck_planner_plan_versions_created_by on public.truck_planner_plan_versions (created_by);
create index if not exists idx_truck_planner_plan_versions_published_by on public.truck_planner_plan_versions (published_by);
create index if not exists idx_truck_planner_plan_versions_truck_id on public.truck_planner_plan_versions (truck_id);
