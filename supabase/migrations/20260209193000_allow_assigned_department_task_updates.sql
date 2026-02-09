-- Allow department-shared tasks (assigned_department) to be updated by:
-- - task coordinators (admin/management/logistics/oscar)
-- - members of the matching department
-- - members of the matching warehouse/house-tech department ("<dept>_warehouse")
--
-- This extends the existing UPDATE RLS policies so department-shared tasks can be
-- edited/completed safely without bypassing RLS.

-- Helper: centralize department-shared task access checks (including _warehouse symmetry)
CREATE OR REPLACE FUNCTION public.can_access_department_task(task_assigned_department text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    task_assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR task_assigned_department = public.current_user_department()
      OR task_assigned_department = public.current_user_department() || '_warehouse'
      OR public.current_user_department() = task_assigned_department || '_warehouse'
    );
$$;


-- Sound
DROP POLICY IF EXISTS "p_sound_job_tasks_public_update_18c15a" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_public_update_18c15a"
ON public.sound_job_tasks
FOR UPDATE
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['sound'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
)
WITH CHECK (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR public.is_admin_or_management()
  OR (public.current_user_department() = ANY (ARRAY['sound'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Lights
DROP POLICY IF EXISTS "p_lights_job_tasks_public_update_df739d" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_public_update_df739d"
ON public.lights_job_tasks
FOR UPDATE
USING (
  (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
)
WITH CHECK (
  public.is_admin_or_management()
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Video
DROP POLICY IF EXISTS "p_video_job_tasks_public_update_a68319" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_public_update_a68319"
ON public.video_job_tasks
FOR UPDATE
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['video'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
)
WITH CHECK (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'house_tech'::text, 'technician'::text, 'logistics'::text, 'oscar'::text]))
  OR (public.current_user_department() = ANY (ARRAY['video'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Production
DROP POLICY IF EXISTS "p_production_job_tasks_public_update_8f14c7" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_update_8f14c7" ON public.production_job_tasks FOR UPDATE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
) WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.is_admin_or_management()
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Administrative
DROP POLICY IF EXISTS "p_administrative_job_tasks_public_update_2d3442" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_update_2d3442" ON public.administrative_job_tasks FOR UPDATE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
) WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.is_admin_or_management()
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- SELECT policy updates for department-shared tasks
-- Ensure department-shared tasks are visible under table RLS (not only via the view).

-- Sound
DROP POLICY IF EXISTS "p_sound_job_tasks_public_select_6e31c0" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_public_select_6e31c0"
ON public.sound_job_tasks
FOR SELECT
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['sound'::text, 'admin'::text, 'management'::text]))
  OR (
    (tour_id IS NOT NULL)
    AND EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.tour_id = sound_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
    )
  )
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Lights
DROP POLICY IF EXISTS "p_lights_job_tasks_public_select_3dc8d6" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_public_select_3dc8d6"
ON public.lights_job_tasks
FOR SELECT
USING (
  (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (
    (tour_id IS NOT NULL)
    AND EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.tour_id = lights_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
    )
  )
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Video
DROP POLICY IF EXISTS "p_video_job_tasks_public_select_493f44" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_public_select_493f44"
ON public.video_job_tasks
FOR SELECT
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (
    (tour_id IS NOT NULL)
    AND EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.tour_id = video_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
    )
  )
  OR (public.current_user_department() = ANY (ARRAY['video'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Production
DROP POLICY IF EXISTS "p_production_job_tasks_public_select_4a8af1" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_select_4a8af1" ON public.production_job_tasks FOR SELECT USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR ((tour_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.tour_assignments ta
      WHERE ta.tour_id = production_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
  ))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);

-- Administrative
DROP POLICY IF EXISTS "p_administrative_job_tasks_public_select_e8a7a0" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_select_e8a7a0" ON public.administrative_job_tasks FOR SELECT USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR ((tour_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.tour_assignments ta
      WHERE ta.tour_id = administrative_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
  ))
  OR assigned_to = auth.uid()
  OR public.can_access_department_task(assigned_department)
);
