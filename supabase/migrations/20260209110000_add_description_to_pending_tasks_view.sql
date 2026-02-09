-- Expose task descriptions in pending_tasks_view so task list UIs can show
-- richer context without extra table fetches.
CREATE OR REPLACE VIEW public.pending_tasks_view
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.job_id,
  NULL::uuid AS tour_id,
  'sound'::text AS department,
  t.task_type,
  t.description,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  NULL::text AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role
FROM public.sound_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics')

UNION ALL

SELECT
  t.id,
  t.job_id,
  NULL::uuid AS tour_id,
  'lights'::text AS department,
  t.task_type,
  t.description,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  NULL::text AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role
FROM public.lights_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics')

UNION ALL

SELECT
  t.id,
  t.job_id,
  NULL::uuid AS tour_id,
  'video'::text AS department,
  t.task_type,
  t.description,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  NULL::text AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role
FROM public.video_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics');
