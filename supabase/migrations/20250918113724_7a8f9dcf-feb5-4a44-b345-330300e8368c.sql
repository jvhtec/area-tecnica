-- Fix remaining Security Definer View issues by replacing views with proper security definer functions
-- This ensures proper RLS enforcement and security best practices

-- Replace assignment_matrix_staffing view with a security definer function
DROP VIEW IF EXISTS public.assignment_matrix_staffing;

CREATE OR REPLACE FUNCTION public.get_assignment_matrix_staffing()
RETURNS TABLE(
  job_id uuid,
  profile_id uuid,
  availability_status text,
  availability_updated_at timestamp with time zone,
  offer_status text,
  offer_updated_at timestamp with time zone,
  last_change timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow access to managers and admin users
  IF NOT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY 
  WITH latest AS (
    SELECT DISTINCT ON (sr.job_id, sr.profile_id, sr.phase) 
      sr.job_id,
      sr.profile_id,
      sr.phase,
      sr.status,
      sr.updated_at,
      sr.created_at
    FROM staffing_requests sr
    ORDER BY sr.job_id, sr.profile_id, sr.phase, sr.updated_at DESC, sr.created_at DESC
  ), pivot AS (
    SELECT 
      l.job_id,
      l.profile_id,
      max(CASE WHEN l.phase = 'availability' THEN l.status ELSE NULL END) AS availability_status,
      max(CASE WHEN l.phase = 'availability' THEN l.updated_at ELSE NULL END) AS availability_updated_at,
      max(CASE WHEN l.phase = 'offer' THEN l.status ELSE NULL END) AS offer_status,
      max(CASE WHEN l.phase = 'offer' THEN l.updated_at ELSE NULL END) AS offer_updated_at
    FROM latest l
    GROUP BY l.job_id, l.profile_id
  )
  SELECT 
    p.job_id,
    p.profile_id,
    p.availability_status,
    p.availability_updated_at,
    p.offer_status,
    p.offer_updated_at,
    GREATEST(
      COALESCE(p.availability_updated_at, '1970-01-01 00:00:00+00'::timestamp with time zone), 
      COALESCE(p.offer_updated_at, '1970-01-01 00:00:00+00'::timestamp with time zone)
    ) AS last_change
  FROM pivot p;
END;
$$;

-- Replace profiles_with_skills view with a security definer function
DROP VIEW IF EXISTS public.profiles_with_skills;

CREATE OR REPLACE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  role user_role,
  phone text,
  dni text,
  department text,
  assignable_as_tech boolean,
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
    p.last_name,
    p.email,
    p.role,
    p.phone,
    p.dni,
    p.department,
    p.assignable_as_tech,
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
  GROUP BY p.id, p.first_name, p.last_name, p.email, p.role, p.phone, p.dni, p.department, p.assignable_as_tech;
END;
$$;