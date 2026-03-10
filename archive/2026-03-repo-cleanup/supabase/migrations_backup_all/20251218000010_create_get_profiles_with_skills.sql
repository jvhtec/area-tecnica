-- Create get_profiles_with_skills RPC function
-- This function returns profiles with their associated skills aggregated as JSON
-- Used by the job assignment matrix and technician availability components

BEGIN;

-- Drop function if it exists
DROP FUNCTION IF EXISTS public.get_profiles_with_skills();

-- Create the function
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
  skills JSON
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
    COALESCE(p.bg_color, '#000000')::text,
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
    ) AS skills
  FROM profiles p
  ORDER BY p.department, p.last_name, p.first_name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_profiles_with_skills() TO authenticated, service_role, anon;

-- Add comment
COMMENT ON FUNCTION get_profiles_with_skills() IS
  'Returns all profiles with their associated skills aggregated as JSON. Used by job assignment matrix and technician availability.';

COMMIT;
