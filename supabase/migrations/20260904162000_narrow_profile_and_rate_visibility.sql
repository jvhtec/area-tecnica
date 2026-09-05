-- SEC-13 follow-up: profiles contain personal data and must not be an
-- organisation-wide directory. Keep direct row access to the owner,
-- operational administrators, and technicians who actually share a job.
-- Consumers that only need display names use get_profile_directory(), which
-- deliberately omits email, phone, DNI, residence and other private fields.

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.current_user_role()) = ANY (ARRAY['admin', 'management', 'logistics'])
  OR EXISTS (
    SELECT 1
    FROM public.job_assignments AS caller_assignment
    JOIN public.job_assignments AS target_assignment
      ON target_assignment.job_id = caller_assignment.job_id
    WHERE caller_assignment.technician_id = (SELECT auth.uid())
      AND target_assignment.technician_id = profiles.id
  )
);

COMMENT ON POLICY "profiles_select" ON public.profiles IS
  'Private profile rows are visible to their owner, operational administrators, or technicians sharing a job.';

CREATE OR REPLACE FUNCTION public.get_profile_directory(
  p_profile_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  department text,
  role public.user_role,
  profile_picture_url text,
  assignable_as_tech boolean,
  warehouse_duty_exempt boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.department,
    p.role,
    p.profile_picture_url,
    p.assignable_as_tech,
    p.warehouse_duty_exempt
  FROM public.profiles AS p
  WHERE auth.uid() IS NOT NULL
    AND (p_profile_ids IS NULL OR p.id = ANY (p_profile_ids))
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, p.id;
$function$;

COMMENT ON FUNCTION public.get_profile_directory(uuid[]) IS
  'Authenticated safe directory projection. Deliberately excludes email, phone, DNI, residence and credentials.';

REVOKE ALL ON FUNCTION public.get_profile_directory(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_directory(uuid[]) TO authenticated, service_role;

-- get_profiles_with_skills predates the profile policy and bypasses it as a
-- definer. It includes private fields because staffing managers need them, so
-- enforce that audience inside the function rather than relying on UI routes.
CREATE OR REPLACE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE(
  id text,
  first_name text,
  last_name text,
  nickname text,
  email text,
  phone text,
  dni text,
  department text,
  role text,
  bg_color text,
  assignable_as_tech boolean,
  skills json,
  profile_picture_url text,
  seasonal_house_tech boolean,
  seasonal_house_tech_start_date date,
  seasonal_house_tech_end_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.current_user_role() = ANY (ARRAY['admin', 'management', 'logistics'])
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

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
        FROM public.profile_skills AS ps
        INNER JOIN public.skills AS s ON s.id = ps.skill_id
        WHERE ps.profile_id = p.id
          AND s.active = true
      ),
      '[]'::json
    ),
    p.profile_picture_url::text,
    p.seasonal_house_tech,
    p.seasonal_house_tech_start_date,
    p.seasonal_house_tech_end_date
  FROM public.profiles AS p
  ORDER BY p.department, p.last_name, p.first_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_profiles_with_skills() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_with_skills() TO authenticated, service_role;

-- Rates are commercial data. UI routes already reserve their editors for
-- management; make the database enforce the same boundary.
DROP POLICY IF EXISTS "p_rate_cards_2025_public_select_7aab22" ON public.rate_cards_2025;
DROP POLICY IF EXISTS "rate_cards_2025_select_policy" ON public.rate_cards_2025;
CREATE POLICY "rate_cards_2025_select_policy"
ON public.rate_cards_2025
FOR SELECT
TO authenticated
USING (public.is_admin_or_management());

DROP POLICY IF EXISTS "p_rate_cards_tour_2025_public_select_c96d89" ON public.rate_cards_tour_2025;
DROP POLICY IF EXISTS "rate_cards_tour_2025_select_policy" ON public.rate_cards_tour_2025;
CREATE POLICY "rate_cards_tour_2025_select_policy"
ON public.rate_cards_tour_2025
FOR SELECT
TO authenticated
USING (public.is_admin_or_management());

DROP POLICY IF EXISTS "rate_extras_2025_select_authenticated" ON public.rate_extras_2025;
CREATE POLICY "rate_extras_2025_select_management"
ON public.rate_extras_2025
FOR SELECT
TO authenticated
USING (public.is_admin_or_management());

REVOKE ALL ON TABLE public.rate_cards_2025 FROM anon;
REVOKE ALL ON TABLE public.rate_cards_tour_2025 FROM anon;
REVOKE ALL ON TABLE public.rate_extras_2025 FROM anon;
