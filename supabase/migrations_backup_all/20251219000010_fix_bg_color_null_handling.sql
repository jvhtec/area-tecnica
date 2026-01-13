-- Fix bg_color to return null instead of hardcoded black
-- This allows the frontend to apply theme-appropriate default colors

BEGIN;

DROP FUNCTION IF EXISTS public.get_profiles_with_skills();

CREATE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE (
  id TEXT,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  dni TEXT,
  department TEXT,
  role TEXT,
  bg_color TEXT,
  assignable_as_tech BOOLEAN,
  skills JSON,
  profile_picture_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::text,
    p.first_name::text,
    p.last_name::text,
    p.nickname::text,
    p.email::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.dni, '')::text,
    COALESCE(p.department, '')::text,
    p.role::text,
    p.bg_color::text,
    p.assignable_as_tech,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'category', s.category,
            'proficiency', ps.proficiency,
            'is_primary', ps.is_primary,
            'notes', ps.notes
          )
          ORDER BY ps.is_primary DESC, ps.proficiency DESC NULLS LAST, s.name
        )
        FROM profile_skills ps
        INNER JOIN skills s ON s.id = ps.skill_id
        WHERE ps.profile_id = p.id
          AND s.active = true
      ),
      '[]'::json
    ) AS skills,
    p.profile_picture_url::text
  FROM profiles p
  ORDER BY p.department, p.last_name, p.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_profiles_with_skills() TO authenticated, service_role, anon;

COMMENT ON FUNCTION get_profiles_with_skills() IS
  'Returns all profiles with their associated skills aggregated as JSON. Includes profile_picture_url for avatar display. Used by job assignment matrix and technician availability.';

COMMIT;
