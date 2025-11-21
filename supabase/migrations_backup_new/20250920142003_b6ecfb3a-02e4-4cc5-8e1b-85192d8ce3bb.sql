-- Fix the is_house_tech function to properly handle enum comparison
CREATE OR REPLACE FUNCTION public.is_house_tech(_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE 
  flag boolean := false;
BEGIN
  SELECT (role = 'house_tech') INTO flag 
  FROM profiles 
  WHERE id = _profile_id;
  
  RETURN COALESCE(flag, false);
END;
$function$;