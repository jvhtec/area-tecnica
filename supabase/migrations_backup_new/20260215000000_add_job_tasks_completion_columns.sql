-- Add completion tracking columns to unified job_tasks table
-- These columns track when and how a task was completed

-- Add completion columns to job_tasks
ALTER TABLE public.job_tasks 
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;

-- Add comments to explain the completion tracking fields
COMMENT ON COLUMN public.job_tasks.completed_at IS 'Timestamp when task was marked complete (manual or automated)';
COMMENT ON COLUMN public.job_tasks.completed_by IS 'User who completed the task (manual) or triggered the automation';
COMMENT ON COLUMN public.job_tasks.completion_source IS 'Source of completion: manual, auto_pesos_doc, auto_consumos_doc, etc.';

-- Backfill existing completed tasks
-- Use updated_at as completed_at for tasks that are already completed
UPDATE public.job_tasks
SET 
  completed_at = COALESCE(updated_at, created_at, now()),
  completion_source = 'backfill'
WHERE status = 'completed' 
  AND completed_at IS NULL;

-- Create indexes for efficient queries on status and completion
CREATE INDEX IF NOT EXISTS idx_job_tasks_status_completed_at 
  ON public.job_tasks(status, completed_at DESC)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_job_tasks_completed_by 
  ON public.job_tasks(completed_by)
  WHERE completed_by IS NOT NULL;

-- Add an index for pending tasks (not completed) 
CREATE INDEX IF NOT EXISTS idx_job_tasks_status_pending 
  ON public.job_tasks(status, due_at)
  WHERE status IN ('not_started', 'in_progress');

-- Update the department-specific views to include completion metadata
-- These views already use SELECT * so they will automatically include the new columns
-- But we'll recreate them explicitly to ensure they're up to date
CREATE OR REPLACE VIEW public.sound_job_tasks_v AS
  SELECT * FROM public.job_tasks WHERE department = 'sound';

CREATE OR REPLACE VIEW public.lights_job_tasks_v AS
  SELECT * FROM public.job_tasks WHERE department = 'lights';

CREATE OR REPLACE VIEW public.video_job_tasks_v AS
  SELECT * FROM public.job_tasks WHERE department = 'video';

-- Update pending_tasks_view to include completion metadata
-- Note: This view filters out completed tasks, so completion fields will typically be NULL
-- However, including them ensures consistency if the view logic changes in the future
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
  st.completed_at,
  st.completed_by,
  st.completion_source,
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
  lt.completed_at,
  lt.completed_by,
  lt.completion_source,
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
  vt.completed_at,
  vt.completed_by,
  vt.completion_source,
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

-- Add comment
COMMENT ON VIEW public.pending_tasks_view IS 'View of pending (not completed) tasks assigned to management/admin/logistics users from all departments (sound, lights, video). Includes completion tracking metadata.';

-- Add or update RLS policies for job_tasks table
-- These policies ensure that completion fields can be updated by authorized users

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Management can manage all job tasks" ON public.job_tasks;
DROP POLICY IF EXISTS "Assigned technicians can view their job tasks" ON public.job_tasks;
DROP POLICY IF EXISTS "Assigned technicians can update their job tasks" ON public.job_tasks;
DROP POLICY IF EXISTS "Job participants can view job tasks" ON public.job_tasks;
DROP POLICY IF EXISTS "Job participants can update job tasks" ON public.job_tasks;

-- Policy 1: Management (admin, management, logistics) can perform all operations on all tasks
CREATE POLICY "Management can manage all job tasks" ON public.job_tasks
  FOR ALL
  USING (
    get_current_user_role() IN ('admin', 'management', 'logistics')
  );

-- Policy 2: Users assigned to a job can view tasks for that job
CREATE POLICY "Job participants can view job tasks" ON public.job_tasks
  FOR SELECT
  USING (
    job_id IS NOT NULL AND (
      -- Check if user is assigned to the job
      EXISTS (
        SELECT 1 FROM job_assignments
        WHERE job_id = job_tasks.job_id
        AND technician_id = auth.uid()
      )
      OR
      -- User is assigned to the task
      assigned_to = auth.uid()
      OR
      -- User created the task
      created_by = auth.uid()
    )
  );

-- Policy 3: Assigned technicians can update their own tasks (including marking as complete)
CREATE POLICY "Job participants can update job tasks" ON public.job_tasks
  FOR UPDATE
  USING (
    job_id IS NOT NULL AND (
      -- User is assigned to the task
      assigned_to = auth.uid()
      OR
      -- User is assigned to the job
      EXISTS (
        SELECT 1 FROM job_assignments
        WHERE job_id = job_tasks.job_id
        AND technician_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    job_id IS NOT NULL AND (
      -- User is assigned to the task
      assigned_to = auth.uid()
      OR
      -- User is assigned to the job
      EXISTS (
        SELECT 1 FROM job_assignments
        WHERE job_id = job_tasks.job_id
        AND technician_id = auth.uid()
      )
    )
  );

-- Policy 4: Authenticated users can insert tasks (subject to application logic)
DROP POLICY IF EXISTS "Authenticated users can create job tasks" ON public.job_tasks;
CREATE POLICY "Authenticated users can create job tasks" ON public.job_tasks
  FOR INSERT
  WITH CHECK (
    -- Only management can create tasks, or user is creating task for a job they're part of
    get_current_user_role() IN ('admin', 'management', 'logistics')
    OR
    EXISTS (
      SELECT 1 FROM job_assignments
      WHERE job_id = job_tasks.job_id
      AND technician_id = auth.uid()
    )
  );

-- Add comment to explain the completion tracking in context of RLS
COMMENT ON COLUMN public.job_tasks.completed_by IS 'User who completed the task. RLS policies ensure only authorized users (assigned technicians, job participants, or management) can set completion fields.';
