-- Update or create get_profiles_with_skills function to include profile_picture_url
-- This function is used by the job assignment matrix to fetch technician profiles
-- SECURITY: Only returns non-sensitive data needed for matrix display

-- Drop existing function to allow return type changes
DROP FUNCTION IF EXISTS public.get_profiles_with_skills();

CREATE OR REPLACE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE (
  id uuid,
  first_name text,
  nickname text,
  last_name text,
  email text,
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
  -- Only return data for authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.nickname,
    p.last_name,
    p.email,
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
  GROUP BY p.id, p.first_name, p.nickname, p.last_name, p.email, p.department, p.role, p.bg_color, p.profile_picture_url, p.assignable_as_tech;
END;
$$;

COMMENT ON FUNCTION public.get_profiles_with_skills() IS
  'Returns profiles with skills for authenticated users only. Excludes sensitive PII (phone, dni). Email included for search/contact. Includes profile_picture_url for avatar display.';

-- Grant necessary permissions - ONLY to authenticated users, NOT to anon
GRANT EXECUTE ON FUNCTION public.get_profiles_with_skills()
  TO authenticated, service_role;

