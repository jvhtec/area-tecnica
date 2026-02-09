-- Prevent stale role/department reads across pooled DB sessions.
-- Use transaction-scoped cache so role/department changes take effect
-- on the next request without requiring connection recycle.

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
     AND cached_uid = current_uid::text
     AND cached_role IS NOT NULL THEN
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
  cached_dept text;
  cached_scope text;
  user_dept text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_scope := current_setting('app.current_user_department_cache_scope', true);
  cached_uid := current_setting('app.current_user_department_uid', true);
  cached_dept := nullif(current_setting('app.current_user_department', true), '');

  IF cached_scope = 'txn'
     AND cached_uid IS NOT NULL
     AND cached_uid = current_uid::text
     AND cached_dept IS NOT NULL THEN
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
