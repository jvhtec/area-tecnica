DROP FUNCTION IF EXISTS public.assert_soundvision_access();

CREATE OR REPLACE FUNCTION public.assert_soundvision_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_department text;
  v_has_flag boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT role, department, COALESCE(soundvision_access_enabled, false)
  INTO v_role, v_department, v_has_flag
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role IN ('admin', 'management') THEN
    RETURN true;
  END IF;

  IF v_has_flag THEN
    RETURN true;
  END IF;

  IF v_role = 'house_tech' AND lower(COALESCE(v_department, '')) = 'sound' THEN
    RETURN true;
  END IF;

  RAISE EXCEPTION 'SoundVision access required' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_soundvision_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_soundvision_access() TO authenticated;
