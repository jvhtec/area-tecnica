-- Forward patch for already-applied Oscar/context migrations.
-- This migration updates live schema state without editing applied history:
--   1) Restrict Oscar UPDATE permissions to owned/assigned tasks.
--   2) Fix transaction cache behavior for NULL role/department values.

-- -----------------------------------------------------------------------------
-- Oscar task update scope: only rows owned by or assigned to current user.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "p_sound_job_tasks_oscar_update" ON public.sound_job_tasks;
CREATE POLICY "p_sound_job_tasks_oscar_update"
ON public.sound_job_tasks
FOR UPDATE
USING (
  public.current_user_role() = 'oscar'
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "p_lights_job_tasks_oscar_update" ON public.lights_job_tasks;
CREATE POLICY "p_lights_job_tasks_oscar_update"
ON public.lights_job_tasks
FOR UPDATE
USING (
  public.current_user_role() = 'oscar'
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "p_video_job_tasks_oscar_update" ON public.video_job_tasks;
CREATE POLICY "p_video_job_tasks_oscar_update"
ON public.video_job_tasks
FOR UPDATE
USING (
  public.current_user_role() = 'oscar'
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- current_user_role/current_user_department: txn cache should preserve NULL.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_role text;
  cached_scope text;
  user_role text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_scope := current_setting('app.current_user_role_cache_scope', true);
  cached_uid := current_setting('app.current_user_role_uid', true);
  cached_role := nullif(current_setting('app.current_user_role', true), '');

  IF cached_scope = 'txn'
     AND cached_uid IS NOT NULL
     AND cached_uid = current_uid::text THEN
    RETURN cached_role;
  END IF;

  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = current_uid;

  PERFORM set_config('app.current_user_role_uid', current_uid::text, true);
  PERFORM set_config('app.current_user_role', coalesce(user_role, ''), true);
  PERFORM set_config('app.current_user_role_cache_scope', 'txn', true);

  RETURN user_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_dept_raw text;
  cached_dept text;
  cached_scope text;
  user_dept text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_scope := current_setting('app.current_user_department_cache_scope', true);
  cached_uid := current_setting('app.current_user_department_uid', true);
  cached_dept_raw := current_setting('app.current_user_department', true);
  cached_dept := nullif(cached_dept_raw, '');

  IF cached_scope = 'txn'
     AND cached_uid IS NOT NULL
     AND cached_uid = current_uid::text
     AND cached_dept_raw IS NOT NULL THEN
    RETURN cached_dept;
  END IF;

  SELECT p.department INTO user_dept
  FROM public.profiles p
  WHERE p.id = current_uid;

  PERFORM set_config('app.current_user_department_uid', current_uid::text, true);
  PERFORM set_config('app.current_user_department', coalesce(user_dept, ''), true);
  PERFORM set_config('app.current_user_department_cache_scope', 'txn', true);

  RETURN user_dept;
END;
$function$;;
