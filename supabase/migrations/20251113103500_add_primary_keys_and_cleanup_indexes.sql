-- Add primary keys to junction tables and remove unused indexes
-- Part 1: Performance optimization migration

-- =====================================================================
-- ADD PRIMARY KEYS TO JUNCTION TABLES
-- =====================================================================

-- Add primary key to job_departments (job_id, department)
ALTER TABLE public.job_departments
ADD PRIMARY KEY (job_id, department);

-- Add primary key to technician_departments (single column)
ALTER TABLE public.technician_departments
ADD PRIMARY KEY (technician_id);

-- =====================================================================
-- REMOVE CLEARLY UNUSED INDEXES
-- These indexes are marked as never used and are obvious candidates for removal
-- =====================================================================

-- Remove unused flex_folders indexes (we already have duplicates issue here)
DROP INDEX IF EXISTS public.idx_flex_folders_tourdate_composite;

-- Remove unused timesheet index
DROP INDEX IF EXISTS public.timesheets_rejected_by_idx;

-- Remove unused tour timeline event indexes
DROP INDEX IF EXISTS public.idx_tour_timeline_events_tour_id;
DROP INDEX IF EXISTS public.idx_tour_timeline_events_date;
DROP INDEX IF EXISTS public.idx_tour_timeline_events_type;

-- Remove unused tour travel segment indexes
DROP INDEX IF EXISTS public.idx_tour_travel_segments_tour_id;
DROP INDEX IF EXISTS public.idx_tour_travel_segments_from_date;
DROP INDEX IF EXISTS public.idx_tour_travel_segments_to_date;

-- Remove unused hoja de ruta indexes
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_status;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_job_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_equipment_hoja_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_templates_event_type;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_rooms_hdr_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_logistics_hdr_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_travel_hdr_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_restaurants_hoja_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_restaurants_place_id;
DROP INDEX IF EXISTS public.idx_hoja_de_ruta_restaurants_selected;

-- Remove unused tour accommodation indexes
DROP INDEX IF EXISTS public.idx_tour_accommodations_date;
DROP INDEX IF EXISTS public.idx_tour_accommodations_check_in;

-- Remove unused tour schedule template indexes
DROP INDEX IF EXISTS public.idx_tour_schedule_templates_tour_id;
DROP INDEX IF EXISTS public.idx_tour_schedule_templates_type;

-- Remove unused staffing request indexes
DROP INDEX IF EXISTS public.staffing_requests_target_date_idx;
DROP INDEX IF EXISTS public.staffing_requests_batch_idx;

-- Remove unused tour/venue indexes
DROP INDEX IF EXISTS public.idx_tours_flex_folders;
DROP INDEX IF EXISTS public.idx_tours_status;
DROP INDEX IF EXISTS public.idx_tours_end_date;
DROP INDEX IF EXISTS public.idx_venues_name;
DROP INDEX IF EXISTS public.idx_venues_city;
DROP INDEX IF EXISTS public.idx_venues_country;

-- Remove unused job rate extras indexes (keep the one that's not duplicate)
DROP INDEX IF EXISTS public.idx_job_rate_extras_status;

-- Remove unused flex/work order indexes
DROP INDEX IF EXISTS public.flex_status_log_processed_at_idx;
DROP INDEX IF EXISTS public.flex_status_log_success_idx;
DROP INDEX IF EXISTS public.flex_work_order_items_work_order_idx;
DROP INDEX IF EXISTS public.flex_work_order_items_assignment_idx;

-- Remove unused task indexes
DROP INDEX IF EXISTS public.idx_sound_job_tasks_status;
DROP INDEX IF EXISTS public.idx_lights_job_tasks_status;
DROP INDEX IF EXISTS public.idx_video_job_tasks_status;
DROP INDEX IF EXISTS public.idx_sub_rentals_batch;
DROP INDEX IF EXISTS public.idx_sub_rentals_job_id;

-- Remove unused personnel indexes
DROP INDEX IF EXISTS public.idx_lights_job_personnel_job_id;
DROP INDEX IF EXISTS public.idx_video_job_personnel_job_id;

-- Remove unused miscellaneous indexes
DROP INDEX IF EXISTS public.idx_tour_dates_flex_folders_created;
DROP INDEX IF EXISTS public.idx_tour_default_tables_type;
DROP INDEX IF EXISTS public.idx_app_changelog_last_updated_desc;
DROP INDEX IF EXISTS public.idx_technician_fridge_in_fridge;
DROP INDEX IF EXISTS public.idx_push_schedules_event_type;
DROP INDEX IF EXISTS public.idx_profiles_last_activity;
DROP INDEX IF EXISTS public.idx_activity_log_job_created_at;
DROP INDEX IF EXISTS public.idx_tour_assignments_department;
DROP INDEX IF EXISTS public.idx_job_assignments_assigned_at;
DROP INDEX IF EXISTS public.idx_job_departments_department;
DROP INDEX IF EXISTS public.idx_morning_subscriptions_enabled;
DROP INDEX IF EXISTS public.idx_job_assignments_use_tour_multipliers;
DROP INDEX IF EXISTS public.idx_timesheets_reminder_sent;

-- Add comment for documentation
COMMENT ON TABLE public.job_departments IS 'Junction table with composite primary key (job_id, department)';
COMMENT ON TABLE public.technician_departments IS 'Table with primary key on technician_id';
