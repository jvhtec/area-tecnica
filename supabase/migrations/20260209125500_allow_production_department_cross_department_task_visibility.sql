-- Allow production department users to view tasks across all departments.
-- This adds SELECT policies without changing existing admin/management/logistics/
-- oscar/assignee paths.

DROP POLICY IF EXISTS "p_sound_job_tasks_production_department_select" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_production_department_select"
ON public.sound_job_tasks
FOR SELECT
USING (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_lights_job_tasks_production_department_select" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_production_department_select"
ON public.lights_job_tasks
FOR SELECT
USING (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_video_job_tasks_production_department_select" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_production_department_select"
ON public.video_job_tasks
FOR SELECT
USING (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_production_job_tasks_production_department_select" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_production_department_select"
ON public.production_job_tasks
FOR SELECT
USING (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_administrative_job_tasks_production_department_select" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_production_department_select"
ON public.administrative_job_tasks
FOR SELECT
USING (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);
