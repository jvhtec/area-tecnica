-- Allow users from production department to create tasks in any department.
-- This enables cross-department task creation while keeping existing admin/
-- management/logistics/oscar policies intact.

DROP POLICY IF EXISTS "p_sound_job_tasks_production_department_insert" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_production_department_insert"
ON public.sound_job_tasks
FOR INSERT
WITH CHECK (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_lights_job_tasks_production_department_insert" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_production_department_insert"
ON public.lights_job_tasks
FOR INSERT
WITH CHECK (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_video_job_tasks_production_department_insert" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_production_department_insert"
ON public.video_job_tasks
FOR INSERT
WITH CHECK (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_production_job_tasks_production_department_insert" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_production_department_insert"
ON public.production_job_tasks
FOR INSERT
WITH CHECK (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);

DROP POLICY IF EXISTS "p_administrative_job_tasks_production_department_insert" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_production_department_insert"
ON public.administrative_job_tasks
FOR INSERT
WITH CHECK (
  lower(coalesce(public.current_user_department(), '')) = ANY (
    ARRAY['production'::text, 'produccion'::text, 'producción'::text]
  )
);
