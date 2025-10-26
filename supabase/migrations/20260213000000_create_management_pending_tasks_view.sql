-- Create a unified view for pending tasks across all departments
-- This view combines sound_job_tasks, lights_job_tasks, and video_job_tasks
-- with job and tour context for management and technician visibility

CREATE OR REPLACE VIEW public.management_pending_tasks AS
-- Sound department tasks
SELECT
  sjt.id AS task_id,
  'sound'::text AS department,
  COALESCE(sjt.task_type, 'unknown')::text AS task_type,
  COALESCE(sjt.status, 'not_started') AS status,
  COALESCE(sjt.progress, 0) AS progress,
  NULL::timestamptz AS due_at, -- due_at field not yet in schema, placeholder for future
  sjt.assigned_to,
  sjt.job_id,
  sjt.tour_id,
  sjt.created_at,
  sjt.updated_at,
  -- Job context
  j.title AS job_title,
  j.start_time AS job_start_time,
  j.end_time AS job_end_time,
  -- Tour context
  t.name AS tour_name,
  t.start_date AS tour_start_date,
  t.end_date AS tour_end_date
FROM public.sound_job_tasks sjt
LEFT JOIN public.jobs j ON sjt.job_id = j.id
LEFT JOIN public.tours t ON sjt.tour_id = t.id
WHERE sjt.assigned_to = auth.uid()
  AND COALESCE(sjt.status, 'not_started') IN ('not_started', 'in_progress')

UNION ALL

-- Lights department tasks
SELECT
  ljt.id AS task_id,
  'lights'::text AS department,
  COALESCE(ljt.task_type, 'unknown')::text AS task_type,
  COALESCE(ljt.status, 'not_started') AS status,
  COALESCE(ljt.progress, 0) AS progress,
  NULL::timestamptz AS due_at,
  ljt.assigned_to,
  ljt.job_id,
  ljt.tour_id,
  ljt.created_at,
  ljt.updated_at,
  -- Job context
  j.title AS job_title,
  j.start_time AS job_start_time,
  j.end_time AS job_end_time,
  -- Tour context
  t.name AS tour_name,
  t.start_date AS tour_start_date,
  t.end_date AS tour_end_date
FROM public.lights_job_tasks ljt
LEFT JOIN public.jobs j ON ljt.job_id = j.id
LEFT JOIN public.tours t ON ljt.tour_id = t.id
WHERE ljt.assigned_to = auth.uid()
  AND COALESCE(ljt.status, 'not_started') IN ('not_started', 'in_progress')

UNION ALL

-- Video department tasks
SELECT
  vjt.id AS task_id,
  'video'::text AS department,
  COALESCE(vjt.task_type, 'unknown')::text AS task_type,
  COALESCE(vjt.status, 'not_started') AS status,
  COALESCE(vjt.progress, 0) AS progress,
  NULL::timestamptz AS due_at,
  vjt.assigned_to,
  vjt.job_id,
  vjt.tour_id,
  vjt.created_at,
  vjt.updated_at,
  -- Job context
  j.title AS job_title,
  j.start_time AS job_start_time,
  j.end_time AS job_end_time,
  -- Tour context
  t.name AS tour_name,
  t.start_date AS tour_start_date,
  t.end_date AS tour_end_date
FROM public.video_job_tasks vjt
LEFT JOIN public.jobs j ON vjt.job_id = j.id
LEFT JOIN public.tours t ON vjt.tour_id = t.id
WHERE vjt.assigned_to = auth.uid()
  AND COALESCE(vjt.status, 'not_started') IN ('not_started', 'in_progress');

-- Grant select permission to authenticated users
-- The view automatically inherits RLS from underlying tables
GRANT SELECT ON public.management_pending_tasks TO authenticated;

-- Add helpful comment
COMMENT ON VIEW public.management_pending_tasks IS 
'Unified view of pending tasks (not_started or in_progress) across all departments. 
Filters to show only tasks assigned to the current user (auth.uid()).
Includes job and tour context for actionable information in the UI.
Relies on RLS policies from underlying sound_job_tasks, lights_job_tasks, and video_job_tasks tables.';

-- Optional: Create indexes on assigned_to columns for better performance
-- These indexes help with the auth.uid() filtering in the view
CREATE INDEX IF NOT EXISTS idx_sound_job_tasks_assigned_to_status 
ON public.sound_job_tasks(assigned_to, status) 
WHERE status IN ('not_started', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_lights_job_tasks_assigned_to_status 
ON public.lights_job_tasks(assigned_to, status) 
WHERE status IN ('not_started', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_video_job_tasks_assigned_to_status 
ON public.video_job_tasks(assigned_to, status) 
WHERE status IN ('not_started', 'in_progress');
