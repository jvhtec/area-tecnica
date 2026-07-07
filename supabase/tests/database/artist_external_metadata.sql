CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(8);

SELECT has_table('public', 'artist_external_metadata', 'artist_external_metadata table exists');

SELECT col_is_pk('public', 'artist_external_metadata', 'id', 'id is the primary key');

SELECT col_is_unique(
  'public', 'artist_external_metadata', ARRAY['normalized_artist_name'],
  'normalized_artist_name has a unique constraint'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.artist_external_metadata'::regclass),
  'row level security is enabled on artist_external_metadata'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'artist_external_metadata'
      AND cmd = 'SELECT'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
  ),
  'select policy scopes reads to admin/management/logistics'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'artist_external_metadata'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  'no client-facing write policies exist; writes go through the service role only'
);

SELECT ok(
  NOT has_column_privilege('anon', 'public.artist_external_metadata', 'normalized_artist_name', 'SELECT'),
  'anon cannot read artist_external_metadata'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.artist_external_metadata'::regclass
      AND tgname = 'set_artist_external_metadata_updated_at'
  ),
  'updated_at trigger is installed'
);

SELECT * FROM finish();
