-- FEST-SEC-01 / FEST-SEC-02 (docs/plans/2026-09-festival-module-audit-roadmap.md).
--
-- SEC-12 (20260904161000) job-scoped festival_artists, and 20260708120000 did
-- the same for festival_artist_files. Their sibling tables still let any
-- technician or house tech read every festival:
--
--   * festival_artist_forms exposes the public form bearer `token`. A token
--     accepts exactly one submission per artist, so reading someone else's
--     token is enough to lock the real artist out of their form.
--   * festival_shifts / festival_shift_assignments expose who works where on
--     every job.
--   * gear setups, stage gear setups, settings, logos, stages and form
--     submissions are job data with no job correlation at all.
--
-- New read model:
--   * Office roles (admin, management, logistics) and house techs keep full
--     read, matching festival_artists.
--   * Technicians read job-level festival data only for jobs they hold a
--     non-declined assignment on, or where they are on a festival shift
--     (some shift crew have no job_assignments row).
--   * Technicians read a shift only when they are on it, it has no department,
--     or it belongs to their department on that job: the matching
--     sound/lights/video/production role on their assignment, or their
--     profile department.
--   * Public form tokens are readable only by the roles that may create them
--     (admin, management, logistics). Public forms keep using their
--     token-validated SECURITY DEFINER RPCs and service-role Edge Functions,
--     so none of this affects the anonymous form.
--
-- Write policies are unchanged. The helpers are SECURITY DEFINER so the
-- festival_shifts and festival_shift_assignments policies can look at each
-- other without RLS recursion.

CREATE OR REPLACE FUNCTION public.festival_department_matches(
  p_department text,
  p_candidate text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_department IS NULL OR p_candidate IS NULL THEN false
    WHEN lower(p_department) IN ('production', 'produccion', 'producción')
      THEN lower(p_candidate) IN ('production', 'produccion', 'producción')
    ELSE lower(p_department) = lower(p_candidate)
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_festival_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_job_id IS NULL OR (SELECT auth.uid()) IS NULL THEN false
    WHEN public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    ) THEN true
    WHEN public.get_current_user_role() = 'technician'::text THEN
      EXISTS (
        SELECT 1
        FROM public.job_assignments ja
        WHERE ja.job_id = p_job_id
          AND ja.technician_id = (SELECT auth.uid())
          AND ja.status IS DISTINCT FROM 'declined'::public.assignment_status
      )
      OR EXISTS (
        SELECT 1
        FROM public.festival_shift_assignments fsa
        JOIN public.festival_shifts fs ON fs.id = fsa.shift_id
        WHERE fs.job_id = p_job_id
          AND fsa.technician_id = (SELECT auth.uid())
      )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_festival_shift(p_shift_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_shift_id IS NULL OR (SELECT auth.uid()) IS NULL THEN false
    WHEN public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    ) THEN EXISTS (SELECT 1 FROM public.festival_shifts fs WHERE fs.id = p_shift_id)
    WHEN public.get_current_user_role() = 'technician'::text THEN EXISTS (
      SELECT 1
      FROM public.festival_shifts fs
      WHERE fs.id = p_shift_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.festival_shift_assignments fsa
            WHERE fsa.shift_id = fs.id
              AND fsa.technician_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1
            FROM public.job_assignments ja
            LEFT JOIN public.profiles p ON p.id = ja.technician_id
            WHERE ja.job_id = fs.job_id
              AND ja.technician_id = (SELECT auth.uid())
              AND ja.status IS DISTINCT FROM 'declined'::public.assignment_status
              AND (
                NULLIF(btrim(fs.department), '') IS NULL
                OR (public.festival_department_matches(fs.department, 'sound') AND ja.sound_role IS NOT NULL)
                OR (public.festival_department_matches(fs.department, 'lights') AND ja.lights_role IS NOT NULL)
                OR (public.festival_department_matches(fs.department, 'video') AND ja.video_role IS NOT NULL)
                OR (public.festival_department_matches(fs.department, 'production') AND ja.production_role IS NOT NULL)
                OR public.festival_department_matches(fs.department, p.department)
              )
          )
        )
    )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.festival_department_matches(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.festival_department_matches(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_read_festival_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_festival_job(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_read_festival_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_festival_shift(uuid) TO authenticated, service_role;

-- Public form tokens: only the roles allowed to create/update them.
DROP POLICY IF EXISTS "p_festival_artist_forms_public_select_aaaff3"
  ON public.festival_artist_forms;
CREATE POLICY "p_festival_artist_forms_public_select_aaaff3"
  ON public.festival_artist_forms
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text]
    )
  );

-- Submissions carry the same technical data that lands on festival_artists,
-- so they follow that artist's job scope (keeps rider status visible to crew).
DROP POLICY IF EXISTS "p_festival_artist_form_submissions_public_select_01654b"
  ON public.festival_artist_form_submissions;
CREATE POLICY "p_festival_artist_form_submissions_public_select_01654b"
  ON public.festival_artist_form_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.festival_artists fa
      WHERE fa.id = festival_artist_form_submissions.artist_id
        AND public.can_read_festival_job(fa.job_id)
    )
  );

DROP POLICY IF EXISTS "p_festival_gear_setups_public_select_16d3e8"
  ON public.festival_gear_setups;
CREATE POLICY "p_festival_gear_setups_public_select_16d3e8"
  ON public.festival_gear_setups
  FOR SELECT
  TO authenticated
  USING (public.can_read_festival_job(job_id));

DROP POLICY IF EXISTS "p_festival_stage_gear_setups_public_select_5e8ceb"
  ON public.festival_stage_gear_setups;
CREATE POLICY "p_festival_stage_gear_setups_public_select_5e8ceb"
  ON public.festival_stage_gear_setups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.festival_gear_setups gs
      WHERE gs.id = festival_stage_gear_setups.gear_setup_id
        AND public.can_read_festival_job(gs.job_id)
    )
  );

DROP POLICY IF EXISTS "p_festival_settings_public_select_c265a8"
  ON public.festival_settings;
CREATE POLICY "p_festival_settings_public_select_c265a8"
  ON public.festival_settings
  FOR SELECT
  TO authenticated
  USING (public.can_read_festival_job(job_id));

DROP POLICY IF EXISTS "p_festival_logos_public_select_c31cbf"
  ON public.festival_logos;
CREATE POLICY "p_festival_logos_public_select_c31cbf"
  ON public.festival_logos
  FOR SELECT
  TO authenticated
  USING (public.can_read_festival_job(job_id));

DROP POLICY IF EXISTS "p_festival_stages_public_select_7a2c19"
  ON public.festival_stages;
CREATE POLICY "p_festival_stages_public_select_7a2c19"
  ON public.festival_stages
  FOR SELECT
  TO authenticated
  USING (public.can_read_festival_job(job_id));

DROP POLICY IF EXISTS "p_festival_shifts_public_select_3970c4"
  ON public.festival_shifts;
CREATE POLICY "p_festival_shifts_public_select_3970c4"
  ON public.festival_shifts
  FOR SELECT
  TO authenticated
  USING (public.can_read_festival_shift(id));

DROP POLICY IF EXISTS "p_festival_shift_assignments_public_select_99870b"
  ON public.festival_shift_assignments;
CREATE POLICY "p_festival_shift_assignments_public_select_99870b"
  ON public.festival_shift_assignments
  FOR SELECT
  TO authenticated
  USING (public.can_read_festival_shift(shift_id));

-- None of these tables has an anonymous reader: the public artist form goes
-- through token-validated RPCs and Edge Functions.
REVOKE ALL ON TABLE public.festival_artist_forms FROM anon;
REVOKE ALL ON TABLE public.festival_artist_form_submissions FROM anon;
REVOKE ALL ON TABLE public.festival_gear_setups FROM anon;
REVOKE ALL ON TABLE public.festival_stage_gear_setups FROM anon;
REVOKE ALL ON TABLE public.festival_settings FROM anon;
REVOKE ALL ON TABLE public.festival_logos FROM anon;
REVOKE ALL ON TABLE public.festival_stages FROM anon;
REVOKE ALL ON TABLE public.festival_shifts FROM anon;
REVOKE ALL ON TABLE public.festival_shift_assignments FROM anon;

COMMENT ON FUNCTION public.can_read_festival_job(uuid) IS
  'RLS helper: office roles and house techs read every festival job; technicians only jobs they are assigned to (non-declined) or have a festival shift on.';
COMMENT ON FUNCTION public.can_read_festival_shift(uuid) IS
  'RLS helper: technicians read a festival shift only when they are on it, it has no department, or it matches their department on that job (assignment role or profile department).';
