-- Create a view for pending tasks (not completed)
-- Returns tasks assigned to users with job/tour context
-- Combines sound, lights, and video task tables
CREATE OR REPLACE VIEW public.pending_tasks_view AS
-- Sound tasks
SELECT 
  st.id,
  st.job_id,
  st.tour_id,
  'sound'::text as department,
  st.task_type,
  st.assigned_to,
  st.status,
  st.progress,
  st.due_at,
  st.priority,
  st.created_at,
  st.updated_at,
  j.job_name,
  j.client,
  t.tour_name,
  p.first_name as assignee_first_name,
  p.last_name as assignee_last_name,
  p.role as assignee_role
FROM public.sound_job_tasks st
LEFT JOIN public.jobs j ON st.job_id = j.id
LEFT JOIN public.tours t ON st.tour_id = t.id
LEFT JOIN public.profiles p ON st.assigned_to = p.id
WHERE st.assigned_to IS NOT NULL
  AND st.status != 'completed'
  AND p.role IN ('management', 'admin', 'logistics')

UNION ALL

-- Lights tasks
SELECT 
  lt.id,
  lt.job_id,
  lt.tour_id,
  'lights'::text as department,
  lt.task_type,
  lt.assigned_to,
  lt.status,
  lt.progress,
  lt.due_at,
  lt.priority,
  lt.created_at,
  lt.updated_at,
  j.job_name,
  j.client,
  t.tour_name,
  p.first_name as assignee_first_name,
  p.last_name as assignee_last_name,
  p.role as assignee_role
FROM public.lights_job_tasks lt
LEFT JOIN public.jobs j ON lt.job_id = j.id
LEFT JOIN public.tours t ON lt.tour_id = t.id
LEFT JOIN public.profiles p ON lt.assigned_to = p.id
WHERE lt.assigned_to IS NOT NULL
  AND lt.status != 'completed'
  AND p.role IN ('management', 'admin', 'logistics')

UNION ALL

-- Video tasks
SELECT 
  vt.id,
  vt.job_id,
  vt.tour_id,
  'video'::text as department,
  vt.task_type,
  vt.assigned_to,
  vt.status,
  vt.progress,
  vt.due_at,
  vt.priority,
  vt.created_at,
  vt.updated_at,
  j.job_name,
  j.client,
  t.tour_name,
  p.first_name as assignee_first_name,
  p.last_name as assignee_last_name,
  p.role as assignee_role
FROM public.video_job_tasks vt
LEFT JOIN public.jobs j ON vt.job_id = j.id
LEFT JOIN public.tours t ON vt.tour_id = t.id
LEFT JOIN public.profiles p ON vt.assigned_to = p.id
WHERE vt.assigned_to IS NOT NULL
  AND vt.status != 'completed'
  AND p.role IN ('management', 'admin', 'logistics')
;

-- Grant access to authenticated users
GRANT SELECT ON public.pending_tasks_view TO authenticated;

-- Add comment
COMMENT ON VIEW public.pending_tasks_view IS 'View of pending (not completed) tasks assigned to management/admin/logistics users from all departments (sound, lights, video)';
