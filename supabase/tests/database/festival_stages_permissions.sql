CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(6);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_stages'
      AND policyname = 'Management can manage festival stages'
  ),
  'legacy admin/management-only festival_stages policy is removed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_stages'
      AND cmd = 'SELECT'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%technician%'
  ),
  'house techs and technicians can read festival stage names'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_stages'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may insert festival stages'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_stages'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may update festival stages'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_stages'
      AND cmd = 'DELETE'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual NOT ILIKE '%house_tech%'
      AND qual NOT ILIKE '%technician%'
  ),
  'festival stage deletes remain restricted to admin/management/logistics'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_gear_setups'
      AND cmd = 'SELECT'
      AND qual ILIKE '%house_tech%'
  ),
  'festival_gear_setups already grants house_tech read access (the fallback max_stages source)'
);

SELECT * FROM finish();
