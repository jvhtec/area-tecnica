-- Fix function search_path mutable warnings by setting search_path for all functions
-- This prevents potential security issues from search_path manipulation

-- Public schema functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.get_tour_complete_timeline(uuid) SET search_path = 'public';
ALTER FUNCTION public.get_tour_date_complete_info(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_venues_updated_at() SET search_path = 'public';
ALTER FUNCTION public.presets_set_department_from_user() SET search_path = 'public';
ALTER FUNCTION public.fn_app_changelog_touch() SET search_path = 'public';
ALTER FUNCTION public.touch_activity_prefs_updated_at() SET search_path = 'public';
ALTER FUNCTION public.sub_rentals_set_department_from_equipment() SET search_path = 'public';
ALTER FUNCTION public.minutes_to_hours_round_30(integer) SET search_path = 'public';
ALTER FUNCTION public.normalize_text_for_match(text) SET search_path = 'public';
ALTER FUNCTION public.json_diff_public(jsonb, jsonb) SET search_path = 'public';
ALTER FUNCTION public.tg_touch_updated_at() SET search_path = 'public';
ALTER FUNCTION public.set_updated_at() SET search_path = 'public';
ALTER FUNCTION public.is_management_or_admin() SET search_path = 'public';
ALTER FUNCTION public.touch_soundvision_file_reviews_updated_at() SET search_path = 'public';
ALTER FUNCTION public.refresh_soundvision_file_review_stats() SET search_path = 'public';
ALTER FUNCTION public.trg_job_required_roles_set_updated_at() SET search_path = 'public';
ALTER FUNCTION public.create_timesheets_for_assignment(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.check_technician_conflicts(uuid, uuid, timestamptz, timestamptz) SET search_path = 'public';
ALTER FUNCTION public.update_push_schedule_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_morning_subscription_updated_at() SET search_path = 'public';

-- Dreamlit schema function
ALTER FUNCTION dreamlit.send_supabase_auth_email(text, text, text) SET search_path = 'dreamlit', 'public';

-- Secrets schema function
ALTER FUNCTION secrets.set_updated_at() SET search_path = 'secrets', 'public';

COMMENT ON SCHEMA public IS 'Functions have been secured with explicit search_path settings';
