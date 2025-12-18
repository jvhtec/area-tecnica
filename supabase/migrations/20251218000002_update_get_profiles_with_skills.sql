-- Update or create get_profiles_with_skills function to include profile_picture_url
-- This function is used by the job assignment matrix to fetch technician profiles

-- Drop existing function to allow return type changes (in case it exists with different signature)
DROP FUNCTION IF EXISTS public.get_profiles_with_skills();

CREATE OR REPLACE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE (
  id uuid,
  first_name text,
  nickname text,
  last_name text,
  email text,
  phone text,
  dni text,
  department text,
  role text,
  bg_color text,
  profile_picture_url text,
  assignable_as_tech boolean,
  skills jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.nickname,
    p.last_name,
    p.email,
    p.phone,
    p.dni,
    p.department,
    p.role,
    p.bg_color,
    p.profile_picture_url,
    p.assignable_as_tech,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', ps.name,
          'category', ps.category,
          'proficiency', ps.proficiency,
          'is_primary', ps.is_primary
        )
      ) FILTER (WHERE ps.name IS NOT NULL),
      '[]'::jsonb
    ) as skills
  FROM profiles p
  LEFT JOIN profile_skills ps ON p.id = ps.profile_id
  GROUP BY p.id, p.first_name, p.nickname, p.last_name, p.email, p.phone, p.dni, p.department, p.role, p.bg_color, p.profile_picture_url, p.assignable_as_tech;
END;
$$;

COMMENT ON FUNCTION public.get_profiles_with_skills() IS
  'Returns all profiles with their skills aggregated as JSONB array. Includes profile_picture_url for avatar display.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_profiles_with_skills()
  TO authenticated, service_role, anon;
