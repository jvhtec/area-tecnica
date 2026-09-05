-- SEC-12: remove accidental anonymous access to confidential festival and rate
-- data. Public artist forms continue to use their token-validated SECURITY
-- DEFINER RPCs, so they do not need direct table privileges.

DROP POLICY IF EXISTS "p_festival_artists_public_select_598f77"
  ON public.festival_artists;

CREATE POLICY "p_festival_artists_public_select_598f77"
  ON public.festival_artists
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    OR (
      public.get_current_user_role() = 'technician'::text
      AND EXISTS (
        SELECT 1
        FROM public.job_assignments ja
        WHERE ja.job_id = festival_artists.job_id
          AND ja.technician_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "p_rate_extras_2025_public_select_0e3de6"
  ON public.rate_extras_2025;

CREATE POLICY "p_rate_extras_2025_public_select_0e3de6"
  ON public.rate_extras_2025
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON TABLE public.festival_artists FROM anon;
REVOKE ALL ON TABLE public.rate_extras_2025 FROM anon;

-- activity_catalog contains only static event-type reference data and is used
-- by unauthenticated clients. Preserve that audience explicitly rather than
-- inheriting it from an unscoped PUBLIC policy.
DROP POLICY IF EXISTS "activity_catalog_read" ON public.activity_catalog;
CREATE POLICY "activity_catalog_read"
  ON public.activity_catalog
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.activity_catalog FROM anon;
GRANT SELECT ON TABLE public.activity_catalog TO anon;

COMMENT ON POLICY "activity_catalog_read" ON public.activity_catalog IS
  'Intentional public read: static, non-confidential event-type reference data.';
