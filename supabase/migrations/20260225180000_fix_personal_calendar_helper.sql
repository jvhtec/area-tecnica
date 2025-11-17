-- Fix has_personal_calendar_access recursion by running it as a SECURITY DEFINER
-- so policy evaluation does not recursively re-enter the profiles policy.

CREATE OR REPLACE FUNCTION public.has_personal_calendar_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = current_user_id
      AND me.role = ANY (ARRAY['house_tech','admin','management','logistics'])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_personal_calendar_access()
  TO authenticated, service_role;
