-- Prevent duplicate assignments for the same task type and context.
-- This closes race conditions for concurrent bulk-assignment actions.

-- Clean up existing duplicates, keeping the earliest row.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY task_type, assigned_to, job_id, tour_id
      ORDER BY created_at, id
    ) AS rn
  FROM public.sound_job_tasks
  WHERE assigned_to IS NOT NULL
)
DELETE FROM public.sound_job_tasks t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY task_type, assigned_to, job_id, tour_id
      ORDER BY created_at, id
    ) AS rn
  FROM public.lights_job_tasks
  WHERE assigned_to IS NOT NULL
)
DELETE FROM public.lights_job_tasks t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY task_type, assigned_to, job_id, tour_id
      ORDER BY created_at, id
    ) AS rn
  FROM public.video_job_tasks
  WHERE assigned_to IS NOT NULL
)
DELETE FROM public.video_job_tasks t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Enforce uniqueness for assigned tasks across job/tour contexts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sound_job_tasks_task_assignee_context
  ON public.sound_job_tasks (task_type, assigned_to, job_id, tour_id) NULLS NOT DISTINCT
  WHERE assigned_to IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lights_job_tasks_task_assignee_context
  ON public.lights_job_tasks (task_type, assigned_to, job_id, tour_id) NULLS NOT DISTINCT
  WHERE assigned_to IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_job_tasks_task_assignee_context
  ON public.video_job_tasks (task_type, assigned_to, job_id, tour_id) NULLS NOT DISTINCT
  WHERE assigned_to IS NOT NULL;
