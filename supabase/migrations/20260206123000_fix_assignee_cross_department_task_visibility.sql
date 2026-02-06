-- Ensure assigned users can see and update their own tasks across departments.
-- This fixes pending task visibility when assignee department differs from task department.

DROP POLICY IF EXISTS "p_sound_job_tasks_public_select_6e31c0" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_public_select_6e31c0"
ON public.sound_job_tasks
FOR SELECT
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
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
);

DROP POLICY IF EXISTS "p_lights_job_tasks_public_select_3dc8d6" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_public_select_3dc8d6"
ON public.lights_job_tasks
FOR SELECT
USING (
  (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
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
);

DROP POLICY IF EXISTS "p_video_job_tasks_public_select_493f44" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_public_select_493f44"
ON public.video_job_tasks
FOR SELECT
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
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
);

DROP POLICY IF EXISTS "p_sound_job_tasks_public_update_18c15a" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_public_update_18c15a"
ON public.sound_job_tasks
FOR UPDATE
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['sound'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
)
WITH CHECK (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  )
  OR public.is_admin_or_management()
  OR (public.current_user_department() = ANY (ARRAY['sound'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "p_lights_job_tasks_public_update_df739d" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_public_update_df739d"
ON public.lights_job_tasks
FOR UPDATE
USING (
  (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  )
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.is_admin_or_management()
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "p_video_job_tasks_public_update_a68319" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_public_update_a68319"
ON public.video_job_tasks
FOR UPDATE
USING (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['video'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.is_admin_or_management()
  OR (public.current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'house_tech'::text, 'technician'::text, 'logistics'::text]))
  OR assigned_to = auth.uid()
);
