-- Job cards and the assignment matrix subscribe to these tables (20261016160000).
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(5);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
  ),
  t || ' is published to supabase_realtime'
)
FROM unnest(ARRAY['job_date_types', 'tour_dates', 'tour_default_sets', 'tour_documents', 'festival_artist_files']) AS t;

SELECT * FROM finish();
