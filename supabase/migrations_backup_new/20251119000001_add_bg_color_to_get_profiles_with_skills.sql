-- Add bg_color to get_profiles_with_skills so UI can display custom row colors
-- Drop and recreate with the extended return signature
DROP FUNCTION IF EXISTS public.get_profiles_with_skills();

CREATE OR REPLACE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE(
  id uuid,
  first_name text,
  nickname text,
  last_name text,
  email text,
  role user_role,
  phone text,
  dni text,
  department text,
  assignable_as_tech boolean,
  bg_color text,
  skills json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow access to managers, admin users, and the user themselves
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND (
      p.role IN ('admin', 'management') OR
      p.id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.nickname,
    p.last_name,
    p.email,
    p.role,
    p.phone,
    p.dni,
    p.department,
    p.assignable_as_tech,
    p.bg_color,
    COALESCE(
      json_agg(
        jsonb_build_object(
          'name', s.name,
          'category', s.category,
          'proficiency', ps.proficiency,
          'is_primary', ps.is_primary
        )
        ORDER BY ps.is_primary DESC NULLS LAST, ps.proficiency DESC NULLS LAST, s.name
      ) FILTER (WHERE s.id IS NOT NULL),
      '[]'::json
    ) AS skills
  FROM profiles p
  LEFT JOIN profile_skills ps ON ps.profile_id = p.id
  LEFT JOIN skills s ON s.id = ps.skill_id AND s.active IS TRUE
  GROUP BY p.id, p.first_name, p.nickname, p.last_name, p.email, p.role, p.phone, p.dni, p.department, p.assignable_as_tech, p.bg_color;
END;
$$;
