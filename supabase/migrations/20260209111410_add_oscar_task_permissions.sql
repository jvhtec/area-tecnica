-- Include Oscar assignees in pending task aggregation.
CREATE OR REPLACE VIEW public.pending_tasks_view
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.job_id,
  NULL::uuid AS tour_id,
  'sound'::text AS department,
  t.task_type,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  NULL::text AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.sound_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics', 'oscar')

UNION ALL

SELECT
  t.id,
  t.job_id,
  NULL::uuid AS tour_id,
  'lights'::text AS department,
  t.task_type,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  NULL::text AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.lights_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics', 'oscar')

UNION ALL

SELECT
  t.id,
  t.job_id,
  NULL::uuid AS tour_id,
  'video'::text AS department,
  t.task_type,
  t.assigned_to,
  t.status,
  t.progress,
  t.due_at,
  t.priority,
  t.created_at,
  t.updated_at,
  j.title AS job_name,
  NULL::text AS client,
  NULL::text AS tour_name,
  p.first_name AS assignee_first_name,
  p.last_name AS assignee_last_name,
  p.role AS assignee_role,
  t.description
FROM public.video_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE
  t.status IN ('not_started', 'in_progress')
  AND p.role IN ('management', 'admin', 'logistics', 'oscar');

-- Oscar role: read all task rows, create in any department, and edit all tasks.
DROP POLICY IF EXISTS "p_sound_job_tasks_oscar_select" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_oscar_select"
ON public.sound_job_tasks
FOR SELECT
USING (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_lights_job_tasks_oscar_select" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_oscar_select"
ON public.lights_job_tasks
FOR SELECT
USING (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_video_job_tasks_oscar_select" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_oscar_select"
ON public.video_job_tasks
FOR SELECT
USING (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_sound_job_tasks_oscar_insert" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_oscar_insert"
ON public.sound_job_tasks
FOR INSERT
WITH CHECK (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_lights_job_tasks_oscar_insert" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_oscar_insert"
ON public.lights_job_tasks
FOR INSERT
WITH CHECK (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_video_job_tasks_oscar_insert" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_oscar_insert"
ON public.video_job_tasks
FOR INSERT
WITH CHECK (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_sound_job_tasks_oscar_update" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_oscar_update"
ON public.sound_job_tasks
FOR UPDATE
USING (public.current_user_role() = 'oscar')
WITH CHECK (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_lights_job_tasks_oscar_update" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_oscar_update"
ON public.lights_job_tasks
FOR UPDATE
USING (public.current_user_role() = 'oscar')
WITH CHECK (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_video_job_tasks_oscar_update" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_oscar_update"
ON public.video_job_tasks
FOR UPDATE
USING (public.current_user_role() = 'oscar')
WITH CHECK (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_sound_job_tasks_oscar_delete" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_oscar_delete"
ON public.sound_job_tasks
FOR DELETE
USING (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_lights_job_tasks_oscar_delete" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_oscar_delete"
ON public.lights_job_tasks
FOR DELETE
USING (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_video_job_tasks_oscar_delete" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_oscar_delete"
ON public.video_job_tasks
FOR DELETE
USING (public.current_user_role() = 'oscar');;
