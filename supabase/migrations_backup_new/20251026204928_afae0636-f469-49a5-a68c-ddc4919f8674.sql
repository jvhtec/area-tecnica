-- Add due_at and priority columns to task tables
ALTER TABLE sound_job_tasks ADD COLUMN IF NOT EXISTS due_at timestamp with time zone;
ALTER TABLE sound_job_tasks ADD COLUMN IF NOT EXISTS priority integer;

ALTER TABLE lights_job_tasks ADD COLUMN IF NOT EXISTS due_at timestamp with time zone;
ALTER TABLE lights_job_tasks ADD COLUMN IF NOT EXISTS priority integer;

ALTER TABLE video_job_tasks ADD COLUMN IF NOT EXISTS due_at timestamp with time zone;
ALTER TABLE video_job_tasks ADD COLUMN IF NOT EXISTS priority integer;

-- Create pending_tasks_view with only job tasks
CREATE OR REPLACE VIEW pending_tasks_view AS
SELECT 
  t.id,
  t.job_id,
  NULL::uuid as tour_id,
  'sound'::text as department,
  t.task_type,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title as job_name,
  NULL::text as client,
  NULL::text as tour_name,
  p.first_name as assignee_first_name,
  p.last_name as assignee_last_name,
  p.role as assignee_role
FROM sound_job_tasks t
LEFT JOIN jobs j ON j.id = t.job_id
LEFT JOIN profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics')

UNION ALL

SELECT 
  t.id,
  t.job_id,
  NULL::uuid as tour_id,
  'lights'::text as department,
  t.task_type,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title as job_name,
  NULL::text as client,
  NULL::text as tour_name,
  p.first_name as assignee_first_name,
  p.last_name as assignee_last_name,
  p.role as assignee_role
FROM lights_job_tasks t
LEFT JOIN jobs j ON j.id = t.job_id
LEFT JOIN profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics')

UNION ALL

SELECT 
  t.id,
  t.job_id,
  NULL::uuid as tour_id,
  'video'::text as department,
  t.task_type,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title as job_name,
  NULL::text as client,
  NULL::text as tour_name,
  p.first_name as assignee_first_name,
  p.last_name as assignee_last_name,
  p.role as assignee_role
FROM video_job_tasks t
LEFT JOIN jobs j ON j.id = t.job_id
LEFT JOIN profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics');

-- Enable RLS on the view
ALTER VIEW pending_tasks_view SET (security_invoker = true);