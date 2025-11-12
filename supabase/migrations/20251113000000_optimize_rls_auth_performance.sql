-- Optimize RLS policies by wrapping auth function calls in subqueries
-- This prevents PostgreSQL from re-evaluating auth functions for each row
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =====================================================================
-- SKILLS TABLE
-- =====================================================================

drop policy if exists "Authenticated can read skills" on public.skills;
create policy "Authenticated can read skills"
on public.skills
for select
using ((select auth.role()) = 'authenticated');

-- =====================================================================
-- PROFILE_SKILLS TABLE
-- =====================================================================

drop policy if exists "Authenticated can read profile_skills" on public.profile_skills;
create policy "Authenticated can read profile_skills"
on public.profile_skills
for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "Owner can manage own profile_skills" on public.profile_skills;
create policy "Owner can manage own profile_skills"
on public.profile_skills
for all
using (profile_id = (select auth.uid()) or public.get_current_user_role() = any (array['admin'::text,'management'::text]))
with check (profile_id = (select auth.uid()) or public.get_current_user_role() = any (array['admin'::text,'management'::text]));

-- =====================================================================
-- STOCK_MOVEMENTS TABLE
-- =====================================================================

drop policy if exists "Users can insert own department movements" on public.stock_movements;
create policy "Users can insert own department movements"
on public.stock_movements
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.department = stock_movements.department
  )
);

drop policy if exists "Users can view own department movements" on public.stock_movements;
create policy "Users can view own department movements"
on public.stock_movements
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.department = stock_movements.department
  )
);

-- =====================================================================
-- TECHNICIAN_WORK_RECORDS TABLE
-- =====================================================================

drop policy if exists "Users can manage own work records" on public.technician_work_records;
create policy "Users can manage own work records"
on public.technician_work_records
for all
using (technician_id = (select auth.uid()))
with check (technician_id = (select auth.uid()));

-- =====================================================================
-- MESSAGES TABLE
-- =====================================================================

drop policy if exists "messages_select_self_or_mgmt" on public.messages;
create policy "messages_select_self_or_mgmt"
on public.messages
for select
using (
  messages.sender_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','management') and p.department = messages.department
  )
);

drop policy if exists "messages_update_status_mgmt" on public.messages;
create policy "messages_update_status_mgmt"
on public.messages
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','management') and p.department = messages.department
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','management') and p.department = messages.department
  )
);

-- =====================================================================
-- TRANSPORT_REQUESTS TABLE
-- =====================================================================

drop policy if exists "Users can create transport requests for assigned jobs" on public.transport_requests;
create policy "Users can create transport requests for assigned jobs"
on public.transport_requests
for insert
with check (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = transport_requests.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can update own transport requests" on public.transport_requests;
create policy "Users can update own transport requests"
on public.transport_requests
for update
using (
  created_by = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
)
with check (
  created_by = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can view accessible transport requests" on public.transport_requests;
create policy "Users can view accessible transport requests"
on public.transport_requests
for select
using (
  created_by = (select auth.uid()) or
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = transport_requests.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- TOUR_TIMELINE_EVENTS TABLE
-- =====================================================================

drop policy if exists "tour_timeline_events_management" on public.tour_timeline_events;
create policy "tour_timeline_events_management"
on public.tour_timeline_events
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "tour_timeline_events_select" on public.tour_timeline_events;
create policy "tour_timeline_events_select"
on public.tour_timeline_events
for select
using (
  exists (
    select 1 from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where j.tour_id = tour_timeline_events.tour_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- RATE_EXTRAS_2025 TABLE
-- =====================================================================

drop policy if exists "rate_extras_2025_mgr_write" on public.rate_extras_2025;
create policy "rate_extras_2025_mgr_write"
on public.rate_extras_2025
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- JOB_RATE_EXTRAS TABLE
-- =====================================================================

drop policy if exists "job_extras_mgr_read" on public.job_rate_extras;
create policy "job_extras_mgr_read"
on public.job_rate_extras
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "job_extras_mgr_write" on public.job_rate_extras;
create policy "job_extras_mgr_write"
on public.job_rate_extras
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "job_extras_tech_read" on public.job_rate_extras;
create policy "job_extras_tech_read"
on public.job_rate_extras
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = job_rate_extras.job_id
    and ja.user_id = (select auth.uid())
  )
);

-- =====================================================================
-- TOUR_TRAVEL_SEGMENTS TABLE
-- =====================================================================

drop policy if exists "tour_travel_segments_management" on public.tour_travel_segments;
create policy "tour_travel_segments_management"
on public.tour_travel_segments
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "tour_travel_segments_select" on public.tour_travel_segments;
create policy "tour_travel_segments_select"
on public.tour_travel_segments
for select
using (
  exists (
    select 1 from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where j.tour_id = tour_travel_segments.tour_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- TOUR_ACCOMMODATIONS TABLE
-- =====================================================================

drop policy if exists "tour_accommodations_management" on public.tour_accommodations;
create policy "tour_accommodations_management"
on public.tour_accommodations
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "tour_accommodations_select" on public.tour_accommodations;
create policy "tour_accommodations_select"
on public.tour_accommodations
for select
using (
  exists (
    select 1 from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where j.tour_id = tour_accommodations.tour_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- TOUR_SCHEDULE_TEMPLATES TABLE
-- =====================================================================

drop policy if exists "tour_schedule_templates_management" on public.tour_schedule_templates;
create policy "tour_schedule_templates_management"
on public.tour_schedule_templates
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "tour_schedule_templates_select" on public.tour_schedule_templates;
create policy "tour_schedule_templates_select"
on public.tour_schedule_templates
for select
using (
  exists (
    select 1 from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where j.tour_id = tour_schedule_templates.tour_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- TRANSPORT_REQUEST_ITEMS TABLE
-- =====================================================================

drop policy if exists "Users can create transport request items" on public.transport_request_items;
create policy "Users can create transport request items"
on public.transport_request_items
for insert
with check (
  exists (
    select 1 from public.transport_requests tr
    where tr.id = transport_request_items.request_id
    and tr.created_by = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can update transport request items" on public.transport_request_items;
create policy "Users can update transport request items"
on public.transport_request_items
for update
using (
  exists (
    select 1 from public.transport_requests tr
    where tr.id = transport_request_items.request_id
    and tr.created_by = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can view accessible transport request items" on public.transport_request_items;
create policy "Users can view accessible transport request items"
on public.transport_request_items
for select
using (
  exists (
    select 1 from public.transport_requests tr
    where tr.id = transport_request_items.request_id
    and (tr.created_by = (select auth.uid()) or
         exists (
           select 1 from public.job_assignments ja
           where ja.job_id = tr.job_id
           and ja.user_id = (select auth.uid())
         ))
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- LIGHTS_JOB_TASKS TABLE
-- =====================================================================

drop policy if exists "Tour participants can view lights tour tasks" on public.lights_job_tasks;
create policy "Tour participants can view lights tour tasks"
on public.lights_job_tasks
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = lights_job_tasks.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- VIDEO_JOB_TASKS TABLE
-- =====================================================================

drop policy if exists "Tour participants can view video tour tasks" on public.video_job_tasks;
create policy "Tour participants can view video tour tasks"
on public.video_job_tasks
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = video_job_tasks.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- TECHNICIAN_AVAILABILITY TABLE
-- =====================================================================

drop policy if exists "Users can create technician availability" on public.technician_availability;
create policy "Users can create technician availability"
on public.technician_availability
for insert
with check (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can delete technician availability" on public.technician_availability;
create policy "Users can delete technician availability"
on public.technician_availability
for delete
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can update technician availability" on public.technician_availability;
create policy "Users can update technician availability"
on public.technician_availability
for update
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- TIMESHEETS TABLE
-- =====================================================================

drop policy if exists "Technicians can create own timesheets" on public.timesheets;
create policy "Technicians can create own timesheets"
on public.timesheets
for insert
with check (user_id = (select auth.uid()));

drop policy if exists "Technicians can update own timesheet signatures" on public.timesheets;
create policy "Technicians can update own timesheet signatures"
on public.timesheets
for update
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Technicians can update own timesheets" on public.timesheets;
create policy "Technicians can update own timesheets"
on public.timesheets
for update
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Technicians can view own timesheets" on public.timesheets;
create policy "Technicians can view own timesheets"
on public.timesheets
for select
using (user_id = (select auth.uid()));

drop policy if exists "Users can view visible timesheet amounts" on public.timesheets;
create policy "Users can view visible timesheet amounts"
on public.timesheets
for select
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- DIRECT_MESSAGES TABLE
-- =====================================================================

drop policy if exists "dm_delete_self" on public.direct_messages;
create policy "dm_delete_self"
on public.direct_messages
for delete
using ((select auth.uid()) in (direct_messages.sender_id, direct_messages.recipient_id));

drop policy if exists "dm_insert_authenticated" on public.direct_messages;
create policy "dm_insert_authenticated"
on public.direct_messages
for insert
with check ((select auth.uid()) in (direct_messages.sender_id, direct_messages.recipient_id));

drop policy if exists "dm_select_self" on public.direct_messages;
create policy "dm_select_self"
on public.direct_messages
for select
using ((select auth.uid()) in (direct_messages.sender_id, direct_messages.recipient_id));

drop policy if exists "dm_update_status_recipient" on public.direct_messages;
create policy "dm_update_status_recipient"
on public.direct_messages
for update
using ((select auth.uid()) = direct_messages.recipient_id)
with check ((select auth.uid()) = direct_messages.recipient_id);

-- =====================================================================
-- APP_CHANGELOG TABLE
-- =====================================================================

drop policy if exists "app_changelog_delete_admin" on public.app_changelog;
create policy "app_changelog_delete_admin"
on public.app_changelog
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

drop policy if exists "app_changelog_insert_editors" on public.app_changelog;
create policy "app_changelog_insert_editors"
on public.app_changelog
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "app_changelog_update_editors" on public.app_changelog;
create policy "app_changelog_update_editors"
on public.app_changelog
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- SOUNDVISION_FILES TABLE
-- =====================================================================

drop policy if exists "soundvision_files_delete_management" on public.soundvision_files;
create policy "soundvision_files_delete_management"
on public.soundvision_files
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "soundvision_files_insert_authorized" on public.soundvision_files;
create policy "soundvision_files_insert_authorized"
on public.soundvision_files
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and (p.role = any(array['admin', 'management'])
         or (p.soundvision_access = true and uploaded_by = (select auth.uid())))
  )
);

drop policy if exists "soundvision_files_select_authenticated" on public.soundvision_files;
create policy "soundvision_files_select_authenticated"
on public.soundvision_files
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and (p.role = any(array['admin', 'management']) or p.soundvision_access = true)
  )
);

drop policy if exists "soundvision_files_update_authorized" on public.soundvision_files;
create policy "soundvision_files_update_authorized"
on public.soundvision_files
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- VENUES TABLE
-- =====================================================================

drop policy if exists "venues_delete_management" on public.venues;
create policy "venues_delete_management"
on public.venues
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "venues_insert_authorized" on public.venues;
create policy "venues_insert_authorized"
on public.venues
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "venues_update_authorized" on public.venues;
create policy "venues_update_authorized"
on public.venues
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- JOB_ASSIGNMENTS TABLE
-- =====================================================================

drop policy if exists "Technicians can view assignments for their jobs" on public.job_assignments;
create policy "Technicians can view assignments for their jobs"
on public.job_assignments
for select
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- PUSH_CRON_EXECUTION_LOG TABLE
-- =====================================================================

drop policy if exists "Admins can view push cron logs" on public.push_cron_execution_log;
create policy "Admins can view push cron logs"
on public.push_cron_execution_log
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

-- =====================================================================
-- JOBS TABLE
-- =====================================================================

drop policy if exists "Users can view jobs they are assigned to" on public.jobs;
create policy "Users can view jobs they are assigned to"
on public.jobs
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = jobs.id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "management_update_job_rates_approval" on public.jobs;
create policy "management_update_job_rates_approval"
on public.jobs
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- TECHNICIAN_FRIDGE TABLE
-- =====================================================================

drop policy if exists "technician_fridge_select_all" on public.technician_fridge;
create policy "technician_fridge_select_all"
on public.technician_fridge
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = 'authenticated'
  )
);

-- =====================================================================
-- NOTIFICATION_SUBSCRIPTIONS TABLE
-- =====================================================================

drop policy if exists "Management can manage notification subscriptions" on public.notification_subscriptions;
create policy "Management can manage notification subscriptions"
on public.notification_subscriptions
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- JOB_DOCUMENTS TABLE
-- =====================================================================

drop policy if exists "Authenticated users can upload job documents" on public.job_documents;
create policy "Authenticated users can upload job documents"
on public.job_documents
for insert
with check ((select auth.role()) = 'authenticated');

drop policy if exists "techs_can_view_visible_docs_for_assigned_jobs" on public.job_documents;
create policy "techs_can_view_visible_docs_for_assigned_jobs"
on public.job_documents
for select
using (
  (visible_to_tech = true and exists (
    select 1 from public.job_assignments ja
    where ja.job_id = job_documents.job_id
    and ja.user_id = (select auth.uid())
  )) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- EQUIPMENT TABLE
-- =====================================================================

drop policy if exists "Users can view own department equipment" on public.equipment;
create policy "Users can view own department equipment"
on public.equipment
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = equipment.department
  )
);

-- =====================================================================
-- JOB_REQUIRED_ROLES TABLE
-- =====================================================================

drop policy if exists "job_required_roles_select" on public.job_required_roles;
create policy "job_required_roles_select"
on public.job_required_roles
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and (profiles.role = any(array['admin', 'management'])
         or exists (
           select 1 from public.job_assignments ja
           where ja.job_id = job_required_roles.job_id
           and ja.user_id = (select auth.uid())
         ))
  )
);

-- =====================================================================
-- SOUNDVISION_FILE_REVIEWS TABLE
-- =====================================================================

drop policy if exists "soundvision_file_reviews_delete_self_or_management" on public.soundvision_file_reviews;
create policy "soundvision_file_reviews_delete_self_or_management"
on public.soundvision_file_reviews
for delete
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "soundvision_file_reviews_insert_self_or_management" on public.soundvision_file_reviews;
create policy "soundvision_file_reviews_insert_self_or_management"
on public.soundvision_file_reviews
for insert
with check (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "soundvision_file_reviews_update_self_or_management" on public.soundvision_file_reviews;
create policy "soundvision_file_reviews_update_self_or_management"
on public.soundvision_file_reviews
for update
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- HOJA_DE_RUTA_RESTAURANTS TABLE
-- =====================================================================

drop policy if exists "Users can create restaurants for their hoja de ruta" on public.hoja_de_ruta_restaurants;
create policy "Users can create restaurants for their hoja de ruta"
on public.hoja_de_ruta_restaurants
for insert
with check (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_restaurants.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can delete restaurants for their hoja de ruta" on public.hoja_de_ruta_restaurants;
create policy "Users can delete restaurants for their hoja de ruta"
on public.hoja_de_ruta_restaurants
for delete
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_restaurants.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can update restaurants for their hoja de ruta" on public.hoja_de_ruta_restaurants;
create policy "Users can update restaurants for their hoja de ruta"
on public.hoja_de_ruta_restaurants
for update
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_restaurants.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can view restaurants for accessible hoja de ruta" on public.hoja_de_ruta_restaurants;
create policy "Users can view restaurants for accessible hoja de ruta"
on public.hoja_de_ruta_restaurants
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_restaurants.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- DAY_PRESET_ASSIGNMENTS TABLE
-- =====================================================================

drop policy if exists "Department can manage preset assignments" on public.day_preset_assignments;
create policy "Department can manage preset assignments"
on public.day_preset_assignments
for all
using (
  exists (
    select 1 from public.profiles p
    join public.presets pr on pr.department = p.department
    where p.id = (select auth.uid())
    and pr.id = day_preset_assignments.preset_id
  )
);

-- =====================================================================
-- PROFILES TABLE
-- =====================================================================

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (id = (select auth.uid()));

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
using (id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- =====================================================================
-- PUSH_CRON_CONFIG TABLE
-- =====================================================================

drop policy if exists "Only admins can modify cron config" on public.push_cron_config;
create policy "Only admins can modify cron config"
on public.push_cron_config
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

drop policy if exists "Only admins can view cron config" on public.push_cron_config;
create policy "Only admins can view cron config"
on public.push_cron_config
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

-- =====================================================================
-- STAFFING_REQUESTS TABLE
-- =====================================================================

drop policy if exists "tech_read_own_staffing" on public.staffing_requests;
create policy "tech_read_own_staffing"
on public.staffing_requests
for select
using (
  user_id = (select auth.uid()) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- PUSH_NOTIFICATION_SCHEDULES TABLE
-- =====================================================================

drop policy if exists "Admins and management can modify schedules" on public.push_notification_schedules;
create policy "Admins and management can modify schedules"
on public.push_notification_schedules
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Admins and management can view schedules" on public.push_notification_schedules;
create policy "Admins and management can view schedules"
on public.push_notification_schedules
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- JOB_WHATSAPP_GROUPS TABLE
-- =====================================================================

drop policy if exists "job_whatsapp_groups_select_mgmt" on public.job_whatsapp_groups;
create policy "job_whatsapp_groups_select_mgmt"
on public.job_whatsapp_groups
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- SOUND_JOB_TASKS TABLE
-- =====================================================================

drop policy if exists "Tour participants can view sound tour tasks" on public.sound_job_tasks;
create policy "Tour participants can view sound tour tasks"
on public.sound_job_tasks
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = sound_job_tasks.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

-- =====================================================================
-- RATE_CARDS_2025 TABLE
-- =====================================================================

drop policy if exists "Management can manage rate cards" on public.rate_cards_2025;
create policy "Management can manage rate cards"
on public.rate_cards_2025
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- SUB_RENTALS TABLE
-- =====================================================================

drop policy if exists "Department can delete sub_rentals" on public.sub_rentals;
create policy "Department can delete sub_rentals"
on public.sub_rentals
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = sub_rentals.department
    and p.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Department can insert sub_rentals" on public.sub_rentals;
create policy "Department can insert sub_rentals"
on public.sub_rentals
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = sub_rentals.department
    and p.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Department can update sub_rentals" on public.sub_rentals;
create policy "Department can update sub_rentals"
on public.sub_rentals
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = sub_rentals.department
    and p.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Department can view sub_rentals" on public.sub_rentals;
create policy "Department can view sub_rentals"
on public.sub_rentals
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = sub_rentals.department
  )
);

-- =====================================================================
-- MORNING_SUMMARY_SUBSCRIPTIONS TABLE
-- =====================================================================

drop policy if exists "Admins can view all subscriptions" on public.morning_summary_subscriptions;
create policy "Admins can view all subscriptions"
on public.morning_summary_subscriptions
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

drop policy if exists "Users can create their own subscriptions" on public.morning_summary_subscriptions;
create policy "Users can create their own subscriptions"
on public.morning_summary_subscriptions
for insert
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own subscriptions" on public.morning_summary_subscriptions;
create policy "Users can delete their own subscriptions"
on public.morning_summary_subscriptions
for delete
using (user_id = (select auth.uid()));

drop policy if exists "Users can update their own subscriptions" on public.morning_summary_subscriptions;
create policy "Users can update their own subscriptions"
on public.morning_summary_subscriptions
for update
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can view their own subscriptions" on public.morning_summary_subscriptions;
create policy "Users can view their own subscriptions"
on public.morning_summary_subscriptions
for select
using (user_id = (select auth.uid()));

-- =====================================================================
-- PRESETS TABLE
-- =====================================================================

drop policy if exists "Department can delete presets" on public.presets;
create policy "Department can delete presets"
on public.presets
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = presets.department
    and p.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Department can insert presets" on public.presets;
create policy "Department can insert presets"
on public.presets
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = presets.department
    and p.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Department can update presets" on public.presets;
create policy "Department can update presets"
on public.presets
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = presets.department
    and p.role = any(array['admin', 'management'])
  )
);

drop policy if exists "Department can view presets" on public.presets;
create policy "Department can view presets"
on public.presets
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = presets.department
  )
);

-- =====================================================================
-- TOURS TABLE
-- =====================================================================

drop policy if exists "management_update_tour_rates_approval" on public.tours;
create policy "management_update_tour_rates_approval"
on public.tours
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "technicians_view_assigned_tours" on public.tours;
create policy "technicians_view_assigned_tours"
on public.tours
for select
using (
  exists (
    select 1 from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where j.tour_id = tours.id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- HOUSE_TECH_RATES TABLE
-- =====================================================================

drop policy if exists "house_rates_mgr_ins" on public.house_tech_rates;
create policy "house_rates_mgr_ins"
on public.house_tech_rates
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "house_rates_mgr_sel" on public.house_tech_rates;
create policy "house_rates_mgr_sel"
on public.house_tech_rates
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

drop policy if exists "house_rates_mgr_upd" on public.house_tech_rates;
create policy "house_rates_mgr_upd"
on public.house_tech_rates
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- JOB_WHATSAPP_GROUP_REQUESTS TABLE
-- =====================================================================

drop policy if exists "job_whatsapp_group_requests_select_mgmt" on public.job_whatsapp_group_requests;
create policy "job_whatsapp_group_requests_select_mgmt"
on public.job_whatsapp_group_requests
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- RATE_CARDS_TOUR_2025 TABLE
-- =====================================================================

drop policy if exists "Management and authenticated users can view tour rate cards" on public.rate_cards_tour_2025;
create policy "Management and authenticated users can view tour rate cards"
on public.rate_cards_tour_2025
for select
using (
  (select auth.role()) = 'authenticated'
);

-- =====================================================================
-- FESTIVAL_ARTIST_FILES TABLE
-- =====================================================================

drop policy if exists "festival_riders_select_job_participants" on public.festival_artist_files;
create policy "festival_riders_select_job_participants"
on public.festival_artist_files
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = festival_artist_files.job_id
    and ja.user_id = (select auth.uid())
  )
);

drop policy if exists "festival_riders_select_management" on public.festival_artist_files;
create policy "festival_riders_select_management"
on public.festival_artist_files
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- FESTIVAL_ARTISTS TABLE
-- =====================================================================

drop policy if exists "festival_artists_select_job_participants" on public.festival_artists;
create policy "festival_artists_select_job_participants"
on public.festival_artists
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = festival_artists.job_id
    and ja.user_id = (select auth.uid())
  )
);

drop policy if exists "festival_artists_select_management" on public.festival_artists;
create policy "festival_artists_select_management"
on public.festival_artists
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
    and profiles.role = any(array['admin', 'management'])
  )
);

-- =====================================================================
-- GLOBAL_STOCK_ENTRIES TABLE
-- =====================================================================

drop policy if exists "Users can insert own department stock" on public.global_stock_entries;
create policy "Users can insert own department stock"
on public.global_stock_entries
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = global_stock_entries.department
  )
);

drop policy if exists "Users can update own department stock" on public.global_stock_entries;
create policy "Users can update own department stock"
on public.global_stock_entries
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = global_stock_entries.department
  )
);

drop policy if exists "Users can view own department stock" on public.global_stock_entries;
create policy "Users can view own department stock"
on public.global_stock_entries
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
    and p.department = global_stock_entries.department
  )
);

-- =====================================================================
-- VACATION_REQUESTS TABLE
-- =====================================================================

drop policy if exists "Management can manage department requests" on public.vacation_requests;
create policy "Management can manage department requests"
on public.vacation_requests
for all
using (
  exists (
    select 1 from public.profiles p
    join public.profiles requester on requester.id = vacation_requests.user_id
    where p.id = (select auth.uid())
    and p.role = any(array['admin', 'management'])
    and p.department = requester.department
  )
);

drop policy if exists "Management can view department requests" on public.vacation_requests;
create policy "Management can view department requests"
on public.vacation_requests
for select
using (
  exists (
    select 1 from public.profiles p
    join public.profiles requester on requester.id = vacation_requests.user_id
    where p.id = (select auth.uid())
    and p.role = any(array['admin', 'management'])
    and p.department = requester.department
  )
);

drop policy if exists "Users can create own vacation requests" on public.vacation_requests;
create policy "Users can create own vacation requests"
on public.vacation_requests
for insert
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own pending requests" on public.vacation_requests;
create policy "Users can update own pending requests"
on public.vacation_requests
for update
using (user_id = (select auth.uid()) and status = 'pending')
with check (user_id = (select auth.uid()));

drop policy if exists "Users can view own vacation requests" on public.vacation_requests;
create policy "Users can view own vacation requests"
on public.vacation_requests
for select
using (user_id = (select auth.uid()));

-- =====================================================================
-- PRESET_ITEMS TABLE
-- =====================================================================

drop policy if exists "Department can manage preset items" on public.preset_items;
create policy "Department can manage preset items"
on public.preset_items
for all
using (
  exists (
    select 1 from public.profiles p
    join public.presets pr on pr.id = preset_items.preset_id
    where p.id = (select auth.uid())
    and p.department = pr.department
  )
);

-- =====================================================================
-- HOJA_DE_RUTA_ACCOMMODATIONS TABLE
-- =====================================================================

drop policy if exists "Users can create accommodations for their hojas de ruta" on public.hoja_de_ruta_accommodations;
create policy "Users can create accommodations for their hojas de ruta"
on public.hoja_de_ruta_accommodations
for insert
with check (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_accommodations.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can delete accommodations for their hojas de ruta" on public.hoja_de_ruta_accommodations;
create policy "Users can delete accommodations for their hojas de ruta"
on public.hoja_de_ruta_accommodations
for delete
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_accommodations.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can update accommodations for their hojas de ruta" on public.hoja_de_ruta_accommodations;
create policy "Users can update accommodations for their hojas de ruta"
on public.hoja_de_ruta_accommodations
for update
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_accommodations.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can view accommodations for accessible hoja de ruta" on public.hoja_de_ruta_accommodations;
create policy "Users can view accommodations for accessible hoja de ruta"
on public.hoja_de_ruta_accommodations
for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = hoja_de_ruta_accommodations.job_id
    and ja.user_id = (select auth.uid())
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'management')
  )
);

drop policy if exists "Users can view accommodations from their hojas de ruta" on public.hoja_de_ruta_accommodations;
create policy "Users can view accommodations from their hojas de ruta"
on public.hoja_de_ruta_accommodations
for select
using (
  hoja_de_ruta_id in (
    select h.id from public.hoja_de_ruta h
    where h.created_by = (select auth.uid()) or h.approved_by = (select auth.uid())
  )
);

-- =====================================================================
-- HOJA_DE_RUTA_ROOM_ASSIGNMENTS TABLE
-- =====================================================================

drop policy if exists "Users can view room assignments from their accommodations" on public.hoja_de_ruta_room_assignments;
create policy "Users can view room assignments from their accommodations"
on public.hoja_de_ruta_room_assignments
for select
using (
  accommodation_id in (
    select a.id from public.hoja_de_ruta_accommodations a
    join public.hoja_de_ruta h on a.hoja_de_ruta_id = h.id
    where h.created_by = (select auth.uid()) or h.approved_by = (select auth.uid())
  )
);

drop policy if exists "Users can create room assignments for their accommodations" on public.hoja_de_ruta_room_assignments;
create policy "Users can create room assignments for their accommodations"
on public.hoja_de_ruta_room_assignments
for insert
with check (
  accommodation_id in (
    select a.id from public.hoja_de_ruta_accommodations a
    join public.hoja_de_ruta h on a.hoja_de_ruta_id = h.id
    where h.created_by = (select auth.uid())
  )
);

drop policy if exists "Users can update room assignments for their accommodations" on public.hoja_de_ruta_room_assignments;
create policy "Users can update room assignments for their accommodations"
on public.hoja_de_ruta_room_assignments
for update
using (
  accommodation_id in (
    select a.id from public.hoja_de_ruta_accommodations a
    join public.hoja_de_ruta h on a.hoja_de_ruta_id = h.id
    where h.created_by = (select auth.uid())
  )
);

drop policy if exists "Users can delete room assignments for their accommodations" on public.hoja_de_ruta_room_assignments;
create policy "Users can delete room assignments for their accommodations"
on public.hoja_de_ruta_room_assignments
for delete
using (
  accommodation_id in (
    select a.id from public.hoja_de_ruta_accommodations a
    join public.hoja_de_ruta h on a.hoja_de_ruta_id = h.id
    where h.created_by = (select auth.uid())
  )
);

-- =====================================================================
-- HOJA_DE_RUTA_TRAVEL_ARRANGEMENTS TABLE
-- =====================================================================

drop policy if exists "Users can view travel arrangements from their hojas de ruta" on public.hoja_de_ruta_travel_arrangements;
create policy "Users can view travel arrangements from their hojas de ruta"
on public.hoja_de_ruta_travel_arrangements
for select
using (
  hoja_de_ruta_id in (
    select h.id from public.hoja_de_ruta h
    where h.created_by = (select auth.uid()) or h.approved_by = (select auth.uid())
  )
);

drop policy if exists "Users can create travel arrangements for their hojas de ruta" on public.hoja_de_ruta_travel_arrangements;
create policy "Users can create travel arrangements for their hojas de ruta"
on public.hoja_de_ruta_travel_arrangements
for insert
with check (
  hoja_de_ruta_id in (
    select h.id from public.hoja_de_ruta h
    where h.created_by = (select auth.uid())
  )
);

drop policy if exists "Users can update travel arrangements for their hojas de ruta" on public.hoja_de_ruta_travel_arrangements;
create policy "Users can update travel arrangements for their hojas de ruta"
on public.hoja_de_ruta_travel_arrangements
for update
using (
  hoja_de_ruta_id in (
    select h.id from public.hoja_de_ruta h
    where h.created_by = (select auth.uid())
  )
);

drop policy if exists "Users can delete travel arrangements for their hojas de ruta" on public.hoja_de_ruta_travel_arrangements;
create policy "Users can delete travel arrangements for their hojas de ruta"
on public.hoja_de_ruta_travel_arrangements
for delete
using (
  hoja_de_ruta_id in (
    select h.id from public.hoja_de_ruta h
    where h.created_by = (select auth.uid())
  )
);
