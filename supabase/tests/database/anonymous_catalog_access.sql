CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(9);

SELECT ok(
  NOT has_table_privilege('anon', 'public.festival_artists', 'SELECT'),
  'anonymous users have no direct SELECT grant on festival artists'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.rate_extras_2025', 'SELECT'),
  'anonymous users have no direct SELECT grant on rate extras'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.festival_artists', 'SELECT'),
  'authenticated users retain festival artist SELECT privilege'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.rate_extras_2025', 'SELECT'),
  'authenticated users retain rate extras SELECT privilege'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND policyname = 'p_festival_artists_public_select_598f77'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual ILIKE '%job_assignments%'
      AND qual ILIKE '%festival_artists.job_id%'
      AND qual ILIKE '%auth.uid()%'
      AND qual NOT ILIKE '%OR true%'
  ),
  'festival artist reads are scoped to authenticated roles and assigned technicians'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rate_extras_2025'
      AND policyname = 'rate_extras_2025_select_management'
      AND roles = ARRAY['authenticated']::name[]
      AND qual ILIKE '%is_admin_or_management%'
      AND qual NOT ILIKE '%OR true%'
  ),
  'rate-extra reads require a management user'
);

SELECT ok(
  has_table_privilege('anon', 'public.activity_catalog', 'SELECT'),
  'anonymous clients retain the intentional activity catalog read grant'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_catalog'
      AND policyname = 'activity_catalog_read'
      AND 'anon' = ANY (roles)
      AND 'authenticated' = ANY (roles)
  ),
  'activity catalog public access names its intended roles explicitly'
);

SELECT ok(
  obj_description(
    (SELECT oid FROM pg_class WHERE relname = 'activity_catalog' AND relnamespace = 'public'::regnamespace),
    'pg_class'
  ) IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM pg_description d
    JOIN pg_policy p ON p.oid = d.objoid
    WHERE p.polname = 'activity_catalog_read'
      AND d.description ILIKE '%Intentional public read%'
  ),
  'the intentional public activity catalog access is documented'
);

SELECT * FROM finish();
