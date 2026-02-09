-- Allow department-shared tasks (assigned_department) to be updated by:
-- - task coordinators (admin/management/logistics/oscar)
-- - members of the matching department
-- - members of the matching warehouse/house-tech department ("<dept>_warehouse")
--
-- This extends the existing UPDATE RLS policies so department-shared tasks can be
-- edited/completed safely without bypassing RLS.

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
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
)
WITH CHECK (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR public.is_admin_or_management()
  OR (public.current_user_department() = ANY (ARRAY['sound'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
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
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
)
WITH CHECK (
  public.is_admin_or_management()
  OR (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.current_user_department() = ANY (ARRAY['lights'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
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
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
)
WITH CHECK (
  (
    (tour_id IS NOT NULL)
    AND (public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  )
  OR (public.current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'house_tech'::text, 'technician'::text, 'logistics'::text, 'oscar'::text]))
  OR (public.current_user_department() = ANY (ARRAY['video'::text, 'admin'::text, 'management'::text]))
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
);

-- Production
DROP POLICY IF EXISTS "p_production_job_tasks_public_update_8f14c7" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_update_8f14c7" ON public.production_job_tasks FOR UPDATE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
) WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.is_admin_or_management()
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
);

-- Administrative
DROP POLICY IF EXISTS "p_administrative_job_tasks_public_update_2d3442" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_update_2d3442" ON public.administrative_job_tasks FOR UPDATE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
) WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text]))
  OR public.is_admin_or_management()
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
  OR (
    assigned_department IS NOT NULL
    AND (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'oscar'::text])
      OR assigned_department = public.current_user_department()
      OR assigned_department = public.current_user_department() || '_warehouse'
    )
  )
);
