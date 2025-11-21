-- Add completion tracking fields to task tables for auto-completion from document uploads
-- These fields allow tracking automated task completion triggered by calculator document uploads

-- Add completion tracking fields to sound_job_tasks
ALTER TABLE public.sound_job_tasks 
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;

-- Add completion tracking fields to lights_job_tasks
ALTER TABLE public.lights_job_tasks 
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;

-- Add completion tracking fields to video_job_tasks
ALTER TABLE public.video_job_tasks 
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;

-- Add comments to explain the completion tracking fields
COMMENT ON COLUMN public.sound_job_tasks.completed_at IS 'Timestamp when task was marked complete (manual or automated)';
COMMENT ON COLUMN public.sound_job_tasks.completed_by IS 'User who completed the task (manual) or triggered the automation';
COMMENT ON COLUMN public.sound_job_tasks.completion_source IS 'Source of completion: manual, auto_pesos_doc, auto_consumos_doc, etc.';

COMMENT ON COLUMN public.lights_job_tasks.completed_at IS 'Timestamp when task was marked complete (manual or automated)';
COMMENT ON COLUMN public.lights_job_tasks.completed_by IS 'User who completed the task (manual) or triggered the automation';
COMMENT ON COLUMN public.lights_job_tasks.completion_source IS 'Source of completion: manual, auto_pesos_doc, auto_consumos_doc, etc.';

COMMENT ON COLUMN public.video_job_tasks.completed_at IS 'Timestamp when task was marked complete (manual or automated)';
COMMENT ON COLUMN public.video_job_tasks.completed_by IS 'User who completed the task (manual) or triggered the automation';
COMMENT ON COLUMN public.video_job_tasks.completion_source IS 'Source of completion: manual, auto_pesos_doc, auto_consumos_doc, etc.';
