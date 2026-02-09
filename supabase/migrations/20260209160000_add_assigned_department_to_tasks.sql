-- Add assigned_department column to all task tables.
-- When set, the task is a shared department task visible to (and actionable by)
-- any member of that department, instead of being individually assigned.
-- assigned_to should be NULL when assigned_department is set.

ALTER TABLE public.sound_job_tasks
  ADD COLUMN IF NOT EXISTS assigned_department text;

ALTER TABLE public.lights_job_tasks
  ADD COLUMN IF NOT EXISTS assigned_department text;

ALTER TABLE public.video_job_tasks
  ADD COLUMN IF NOT EXISTS assigned_department text;

ALTER TABLE public.production_job_tasks
  ADD COLUMN IF NOT EXISTS assigned_department text;

ALTER TABLE public.administrative_job_tasks
  ADD COLUMN IF NOT EXISTS assigned_department text;

-- Enforce mutual exclusivity: a task is either individually assigned OR department-shared.
ALTER TABLE public.sound_job_tasks
  ADD CONSTRAINT sound_job_tasks_assignment_excl CHECK (NOT (assigned_to IS NOT NULL AND assigned_department IS NOT NULL));
ALTER TABLE public.lights_job_tasks
  ADD CONSTRAINT lights_job_tasks_assignment_excl CHECK (NOT (assigned_to IS NOT NULL AND assigned_department IS NOT NULL));
ALTER TABLE public.video_job_tasks
  ADD CONSTRAINT video_job_tasks_assignment_excl CHECK (NOT (assigned_to IS NOT NULL AND assigned_department IS NOT NULL));
ALTER TABLE public.production_job_tasks
  ADD CONSTRAINT production_job_tasks_assignment_excl CHECK (NOT (assigned_to IS NOT NULL AND assigned_department IS NOT NULL));
ALTER TABLE public.administrative_job_tasks
  ADD CONSTRAINT administrative_job_tasks_assignment_excl CHECK (NOT (assigned_to IS NOT NULL AND assigned_department IS NOT NULL));

-- Index assigned_department for efficient filtering in the pending_tasks_view
-- and realtime subscription filters.
CREATE INDEX IF NOT EXISTS idx_sound_job_tasks_assigned_dept ON public.sound_job_tasks (assigned_department) WHERE assigned_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lights_job_tasks_assigned_dept ON public.lights_job_tasks (assigned_department) WHERE assigned_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_job_tasks_assigned_dept ON public.video_job_tasks (assigned_department) WHERE assigned_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_job_tasks_assigned_dept ON public.production_job_tasks (assigned_department) WHERE assigned_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_administrative_job_tasks_assigned_dept ON public.administrative_job_tasks (assigned_department) WHERE assigned_department IS NOT NULL;

-- Recreate pending_tasks_view to:
-- 1. Include tasks with assigned_department (department-shared tasks)
-- 2. Add the assigned_department column to the view output
-- 3. Include production and administrative department tables
-- 4. Include tour_id properly from the task rows
CREATE OR REPLACE VIEW public.pending_tasks_view
WITH (security_invoker = true) AS

-- Sound: individually assigned
SELECT
  t.id,
  t.job_id,
  t.tour_id,
  'sound'::text AS department,
  t.task_type,
  t.assigned_to,
  t.assigned_department,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  tr.name AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.sound_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.tours tr ON tr.id = t.tour_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND (
    (t.assigned_to IS NOT NULL AND p.role IN ('management', 'admin', 'logistics', 'oscar'))
    OR t.assigned_department IS NOT NULL
  )

UNION ALL

-- Lights: individually assigned
SELECT
  t.id,
  t.job_id,
  t.tour_id,
  'lights'::text AS department,
  t.task_type,
  t.assigned_to,
  t.assigned_department,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  tr.name AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.lights_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.tours tr ON tr.id = t.tour_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND (
    (t.assigned_to IS NOT NULL AND p.role IN ('management', 'admin', 'logistics', 'oscar'))
    OR t.assigned_department IS NOT NULL
  )

UNION ALL

-- Video: individually assigned
SELECT
  t.id,
  t.job_id,
  t.tour_id,
  'video'::text AS department,
  t.task_type,
  t.assigned_to,
  t.assigned_department,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  tr.name AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.video_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.tours tr ON tr.id = t.tour_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND (
    (t.assigned_to IS NOT NULL AND p.role IN ('management', 'admin', 'logistics', 'oscar'))
    OR t.assigned_department IS NOT NULL
  )

UNION ALL

-- Production
SELECT
  t.id,
  t.job_id,
  t.tour_id,
  'production'::text AS department,
  t.task_type,
  t.assigned_to,
  t.assigned_department,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  tr.name AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.production_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.tours tr ON tr.id = t.tour_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND (
    (t.assigned_to IS NOT NULL AND p.role IN ('management', 'admin', 'logistics', 'oscar'))
    OR t.assigned_department IS NOT NULL
  )

UNION ALL

-- Administrative
SELECT
  t.id,
  t.job_id,
  t.tour_id,
  'administrative'::text AS department,
  t.task_type,
  t.assigned_to,
  t.assigned_department,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  tr.name AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.administrative_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.tours tr ON tr.id = t.tour_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND (
    (t.assigned_to IS NOT NULL AND p.role IN ('management', 'admin', 'logistics', 'oscar'))
    OR t.assigned_department IS NOT NULL
  );
