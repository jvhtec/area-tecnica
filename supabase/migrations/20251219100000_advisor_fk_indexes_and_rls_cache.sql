-- =============================================================================
-- Advisor Performance Fixes (Part 1)
-- =============================================================================
-- 1) Improve RLS helper cache (safe across pooled connections)
-- 2) Add missing FK indexes reported by Supabase Advisor (deduped by table+columns)
-- =============================================================================

-- =============================================================================
-- 1) RLS helper functions: cache across transactions safely
-- =============================================================================
-- These helpers cache by (uid -> role/department) in session settings.
-- The uid check prevents leaking cached values when a pooled connection is reused.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_role text;
  user_role text;
BEGIN
  -- Never trust cached values for anon requests
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_uid := current_setting('app.current_user_role_uid', true);
  cached_role := nullif(current_setting('app.current_user_role', true), '');

  IF cached_uid IS NOT NULL AND cached_uid = current_uid::text AND cached_role IS NOT NULL THEN
    RETURN cached_role;
  END IF;

  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = current_uid;

  IF user_role IS NOT NULL THEN
    PERFORM set_config('app.current_user_role_uid', current_uid::text, false);
    PERFORM set_config('app.current_user_role', user_role, false);
  END IF;

  RETURN user_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_dept text;
  user_dept text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_uid := current_setting('app.current_user_department_uid', true);
  cached_dept := nullif(current_setting('app.current_user_department', true), '');

  IF cached_uid IS NOT NULL AND cached_uid = current_uid::text AND cached_dept IS NOT NULL THEN
    RETURN cached_dept;
  END IF;

  SELECT p.department INTO user_dept
  FROM public.profiles p
  WHERE p.id = current_uid;

  IF user_dept IS NOT NULL THEN
    PERFORM set_config('app.current_user_department_uid', current_uid::text, false);
    PERFORM set_config('app.current_user_department', user_dept, false);
  END IF;

  RETURN user_dept;
END;
$function$;

-- =============================================================================
-- 2) Missing FK indexes
-- =============================================================================

create index if not exists idx_activity_reads_activity_id_fk_83a08f on public.activity_reads (activity_id);
create index if not exists idx_announcements_created_by_fk_33368d on public.announcements (created_by);
create index if not exists idx_app_changelog_created_by_fk_285ab7 on public.app_changelog (created_by);
create index if not exists idx_assignment_notifications_job_id_fk_5d738e on public.assignment_notifications (job_id);
create index if not exists idx_assignment_notifications_technician_id_fk_6524ee on public.assignment_notifications (technician_id);
create index if not exists idx_availability_conflicts_job_id_fk_2e2983 on public.availability_conflicts (job_id);
create index if not exists idx_availability_conflicts_resolved_by_fk_6d0842 on public.availability_conflicts (resolved_by);
create index if not exists idx_availability_conflicts_user_id_fk_66fed1 on public.availability_conflicts (user_id);
create index if not exists idx_availability_exceptions_user_id_fk_0432be on public.availability_exceptions (user_id);
create index if not exists idx_bug_reports_resolved_by_fk_c55ced on public.bug_reports (resolved_by);
create index if not exists idx_day_assignments_user_id_fk_8c0c34 on public.day_assignments (user_id);
create index if not exists idx_day_preset_assignments_assigned_by_fk_33856a on public.day_preset_assignments (assigned_by);
create index if not exists idx_day_preset_assignments_preset_id_fk_2a5028 on public.day_preset_assignments (preset_id);
create index if not exists idx_expense_permissions_category_slug_fk_686cbc on public.expense_permissions (category_slug);
create index if not exists idx_expense_permissions_created_by_fk_44bcf2 on public.expense_permissions (created_by);
create index if not exists idx_expense_permissions_updated_by_fk_4d553c on public.expense_permissions (updated_by);
create index if not exists idx_festival_artist_files_artist_id_fk_efdefd on public.festival_artist_files (artist_id);
create index if not exists idx_festival_artist_files_uploaded_by_fk_4bd676 on public.festival_artist_files (uploaded_by);
create index if not exists idx_festival_artist_form_submissions_artist_id_fk_bed7e1 on public.festival_artist_form_submissions (artist_id);
create index if not exists idx_festival_artist_form_submissions_form_id_fk_0f563e on public.festival_artist_form_submissions (form_id);
create index if not exists idx_festival_artist_forms_artist_id_fk_830e7a on public.festival_artist_forms (artist_id);
create index if not exists idx_festival_logos_uploaded_by_fk_18b6e9 on public.festival_logos (uploaded_by);
create index if not exists idx_festival_settings_job_id_fk_be86c0 on public.festival_settings (job_id);
create index if not exists idx_festival_shift_assignments_shift_id_fk_076ef4 on public.festival_shift_assignments (shift_id);
create index if not exists idx_festival_shift_assignments_technician_id_fk_1dcb3b on public.festival_shift_assignments (technician_id);
create index if not exists idx_festival_shifts_job_id_fk_a67804 on public.festival_shifts (job_id);
create index if not exists idx_flex_status_log_processed_by_fk_a480ff on public.flex_status_log (processed_by);
create index if not exists idx_global_stock_entries_equipment_id_fk_83ddd0 on public.global_stock_entries (equipment_id);
create index if not exists idx_hoja_de_ruta_approved_by_fk_d12bba on public.hoja_de_ruta (approved_by);
create index if not exists idx_hoja_de_ruta_created_by_fk_371e81 on public.hoja_de_ruta (created_by);
create index if not exists idx_hoja_de_ruta_last_modified_by_fk_7216fd on public.hoja_de_ruta (last_modified_by);
create index if not exists idx_hoja_de_ruta_accommodations_hoja_de_ruta_id_fk_4e429b on public.hoja_de_ruta_accommodations (hoja_de_ruta_id);
create index if not exists idx_hoja_de_ruta_equipment_hoja_de_ruta_id_fk_c967d0 on public.hoja_de_ruta_equipment (hoja_de_ruta_id);
create index if not exists idx_hoja_de_ruta_room_assignments_accommodation_id_fk_e15c1e on public.hoja_de_ruta_room_assignments (accommodation_id);
create index if not exists idx_hoja_de_ruta_rooms_hoja_de_ruta_id_fk_0f272c on public.hoja_de_ruta_rooms (hoja_de_ruta_id);
create index if not exists idx_hoja_de_ruta_rooms_staff_member1_id_fk_83b07a on public.hoja_de_ruta_rooms (staff_member1_id);
create index if not exists idx_hoja_de_ruta_rooms_staff_member2_id_fk_3213ae on public.hoja_de_ruta_rooms (staff_member2_id);
create index if not exists idx_hoja_de_ruta_templates_created_by_fk_d120fb on public.hoja_de_ruta_templates (created_by);
create index if not exists idx_hoja_de_ruta_transport_hoja_de_ruta_id_fk_e3d053 on public.hoja_de_ruta_transport (hoja_de_ruta_id);
create index if not exists idx_hoja_de_ruta_travel_hoja_de_ruta_id_fk_f780a5 on public.hoja_de_ruta_travel (hoja_de_ruta_id);
create index if not exists idx_hoja_de_ruta_travel_arrangements_hoja_de_ruta_id_fk_7f2fcd on public.hoja_de_ruta_travel_arrangements (hoja_de_ruta_id);
create index if not exists idx_job_assignments_assigned_by_fk_21c295 on public.job_assignments (assigned_by);
create index if not exists idx_job_documents_uploaded_by_fk_f2aff8 on public.job_documents (uploaded_by);
create index if not exists idx_job_expenses_approved_by_fk_9e8e5e on public.job_expenses (approved_by);
create index if not exists idx_job_expenses_category_slug_fk_dc4463 on public.job_expenses (category_slug);
create index if not exists idx_job_expenses_created_by_fk_c8a31d on public.job_expenses (created_by);
create index if not exists idx_job_expenses_rejected_by_fk_05df5b on public.job_expenses (rejected_by);
create index if not exists idx_job_expenses_submitted_by_fk_3fe516 on public.job_expenses (submitted_by);
create index if not exists idx_job_expenses_updated_by_fk_eaafea on public.job_expenses (updated_by);
create index if not exists idx_job_milestone_definitions_job_id_fk_796ded on public.job_milestone_definitions (job_id);
create index if not exists idx_job_milestones_completed_by_fk_b788fb on public.job_milestones (completed_by);
create index if not exists idx_job_milestones_definition_id_fk_7ef072 on public.job_milestones (definition_id);
create index if not exists idx_job_milestones_job_id_fk_0eb77f on public.job_milestones (job_id);
create index if not exists idx_job_required_roles_created_by_fk_ef6347 on public.job_required_roles (created_by);
create index if not exists idx_job_required_roles_updated_by_fk_becf05 on public.job_required_roles (updated_by);
create index if not exists idx_jobs_rates_approved_by_fk_e92127 on public.jobs (rates_approved_by);
create index if not exists idx_lights_job_personnel_job_id_fk_a9a44d on public.lights_job_personnel (job_id);
create index if not exists idx_lights_job_tasks_completed_by_fk_0a8fb7 on public.lights_job_tasks (completed_by);
create index if not exists idx_lights_job_tasks_tour_id_fk_37db06 on public.lights_job_tasks (tour_id);
create index if not exists idx_lights_memoria_tecnica_documents_job_id_fk_9cff88 on public.lights_memoria_tecnica_documents (job_id);
create index if not exists idx_memoria_tecnica_documents_job_id_fk_bd155a on public.memoria_tecnica_documents (job_id);
create index if not exists idx_notification_preferences_user_id_fk_066900 on public.notification_preferences (user_id);
create index if not exists idx_power_requirement_tables_job_id_fk_209c8a on public.power_requirement_tables (job_id);
create index if not exists idx_preset_items_equipment_id_fk_754df4 on public.preset_items (equipment_id);
create index if not exists idx_preset_items_preset_id_fk_3efc66 on public.preset_items (preset_id);
create index if not exists idx_presets_created_by_fk_7a24b2 on public.presets (created_by);
create index if not exists idx_presets_user_id_fk_299400 on public.presets (user_id);
create index if not exists idx_profile_skills_skill_id_fk_9dcef7 on public.profile_skills (skill_id);
create index if not exists idx_sound_job_tasks_completed_by_fk_ffb477 on public.sound_job_tasks (completed_by);
create index if not exists idx_sound_job_tasks_tour_id_fk_648ee7 on public.sound_job_tasks (tour_id);
create index if not exists idx_staffing_events_staffing_request_id_fk_1865be on public.staffing_events (staffing_request_id);
create index if not exists idx_staffing_requests_job_id_fk_759069 on public.staffing_requests (job_id);
create index if not exists idx_stock_movements_equipment_id_fk_b99850 on public.stock_movements (equipment_id);
create index if not exists idx_sub_rentals_created_by_fk_7ef24a on public.sub_rentals (created_by);
create index if not exists idx_sub_rentals_equipment_id_fk_4cbad2 on public.sub_rentals (equipment_id);
create index if not exists idx_sub_rentals_job_id_fk_e29a20 on public.sub_rentals (job_id);
create index if not exists idx_task_documents_lights_task_id_fk_b649c0 on public.task_documents (lights_task_id);
create index if not exists idx_task_documents_sound_task_id_fk_988e85 on public.task_documents (sound_task_id);
create index if not exists idx_task_documents_uploaded_by_fk_b6c0b7 on public.task_documents (uploaded_by);
create index if not exists idx_task_documents_video_task_id_fk_5a4ec0 on public.task_documents (video_task_id);
create index if not exists idx_technician_work_records_job_id_fk_c605de on public.technician_work_records (job_id);
create index if not exists idx_technician_work_records_reviewed_by_fk_3afbb4 on public.technician_work_records (reviewed_by);
create index if not exists idx_technician_work_records_technician_id_fk_94caa1 on public.technician_work_records (technician_id);
create index if not exists idx_timesheets_approved_by_fk_4db69b on public.timesheets (approved_by);
create index if not exists idx_timesheets_created_by_fk_07c199 on public.timesheets (created_by);
create index if not exists idx_timesheets_rejected_by_fk_f9ba2f on public.timesheets (rejected_by);
create index if not exists idx_tour_accommodations_created_by_fk_ad284c on public.tour_accommodations (created_by);
create index if not exists idx_tour_accommodations_location_id_fk_7365aa on public.tour_accommodations (location_id);
create index if not exists idx_tour_accommodations_tour_date_id_fk_e90afe on public.tour_accommodations (tour_date_id);
create index if not exists idx_tour_assignments_assigned_by_fk_c79065 on public.tour_assignments (assigned_by);
create index if not exists idx_tour_date_power_overrides_tour_date_id_fk_1d086d on public.tour_date_power_overrides (tour_date_id);
create index if not exists idx_tour_date_weight_overrides_tour_date_id_fk_c9bb9d on public.tour_date_weight_overrides (tour_date_id);
create index if not exists idx_tour_dates_location_id_fk_a736c2 on public.tour_dates (location_id);
create index if not exists idx_tour_documents_tour_id_fk_8ce7e2 on public.tour_documents (tour_id);
create index if not exists idx_tour_documents_uploaded_by_fk_7adb94 on public.tour_documents (uploaded_by);
create index if not exists idx_tour_logos_tour_id_fk_99047a on public.tour_logos (tour_id);
create index if not exists idx_tour_logos_uploaded_by_fk_893102 on public.tour_logos (uploaded_by);
create index if not exists idx_tour_power_defaults_tour_id_fk_c6fcbe on public.tour_power_defaults (tour_id);
create index if not exists idx_tour_schedule_templates_created_by_fk_6b3e1a on public.tour_schedule_templates (created_by);
create index if not exists idx_tour_schedule_templates_tour_id_fk_2217d2 on public.tour_schedule_templates (tour_id);
create index if not exists idx_tour_timeline_events_created_by_fk_eb1ed0 on public.tour_timeline_events (created_by);
create index if not exists idx_tour_timeline_events_location_id_fk_9d0a0d on public.tour_timeline_events (location_id);
create index if not exists idx_tour_timeline_events_tour_id_fk_b8b93e on public.tour_timeline_events (tour_id);
create index if not exists idx_tour_travel_segments_created_by_fk_f8ab89 on public.tour_travel_segments (created_by);
create index if not exists idx_tour_travel_segments_from_location_id_fk_b1f004 on public.tour_travel_segments (from_location_id);
create index if not exists idx_tour_travel_segments_from_tour_date_id_fk_b6e1b1 on public.tour_travel_segments (from_tour_date_id);
create index if not exists idx_tour_travel_segments_to_location_id_fk_7a0f26 on public.tour_travel_segments (to_location_id);
create index if not exists idx_tour_travel_segments_to_tour_date_id_fk_a249f2 on public.tour_travel_segments (to_tour_date_id);
create index if not exists idx_tour_travel_segments_tour_id_fk_68180b on public.tour_travel_segments (tour_id);
create index if not exists idx_tour_weight_defaults_tour_id_fk_d1bada on public.tour_weight_defaults (tour_id);
create index if not exists idx_tours_created_by_fk_ed5af4 on public.tours (created_by);
create index if not exists idx_tours_rates_approved_by_fk_1659e3 on public.tours (rates_approved_by);
create index if not exists idx_transport_requests_created_by_fk_358913 on public.transport_requests (created_by);
create index if not exists idx_transport_requests_fulfilled_by_fk_773cd9 on public.transport_requests (fulfilled_by);
create index if not exists idx_vacation_requests_approved_by_fk_01bc0a on public.vacation_requests (approved_by);
create index if not exists idx_video_job_personnel_job_id_fk_ded354 on public.video_job_personnel (job_id);
create index if not exists idx_video_job_tasks_completed_by_fk_ea7c70 on public.video_job_tasks (completed_by);
create index if not exists idx_video_job_tasks_tour_id_fk_b2120e on public.video_job_tasks (tour_id);
create index if not exists idx_video_memoria_tecnica_documents_job_id_fk_21a7f5 on public.video_memoria_tecnica_documents (job_id);

