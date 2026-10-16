-- Skill names are unique regardless of case, and the catalog is published to
-- realtime (20261016170000).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(4);

SELECT is(
  (SELECT count(*) FROM (
    SELECT lower(name) FROM public.skills GROUP BY lower(name) HAVING count(*) > 1
  ) dupes),
  0::bigint,
  'no two skills share a name up to case'
);

INSERT INTO public.skills (name, category, active) VALUES ('pgtap skill', 'general', true);

SELECT throws_ok(
  $$INSERT INTO public.skills (name, category, active) VALUES ('PGTAP Skill', 'general', true)$$,
  '23505',
  NULL,
  'a skill that differs only in case is rejected'
);

SELECT has_index('public', 'skills', 'skills_name_lower_key', 'skills has the case-insensitive name index');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'skills'
  ),
  'skills is published to supabase_realtime'
);

SELECT * FROM finish();
ROLLBACK;
