CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(6);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND policyname IN (
        'p_festival_artists_public_delete_8f2ede',
        'p_festival_artists_public_insert_d3bb11',
        'p_festival_artists_public_update_4616fe'
      )
  ),
  3,
  'festival_artists keeps the expected mutation policies'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%logistics%'
  ),
  'festival_artists mutation policies do not allow logistics'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may insert festival artists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may update festival artists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'DELETE'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual NOT ILIKE '%house_tech%'
      AND qual NOT ILIKE '%logistics%'
  ),
  'festival artist deletes remain management-only'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'SELECT'
      AND qual ILIKE '%house_tech%'
  ),
  'house techs retain festival artist read access'
);

SELECT * FROM finish();
