CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(10);

-- ---------------------------------------------------------------------------
-- `public.system_errors` is the only server-side sink the browser has for error
-- context (src/lib/errorTracking.ts). Its `system` allowlist is duplicated as a
-- TypeScript union, and the two drift silently: a name added to the union but
-- not to the constraint fails at INSERT time, in production, on the very path
-- that exists to report failures. These tests pin the allowlist so that drift
-- fails in CI instead.
--
-- The names below are pinned to `SYSTEM_NAMES` in src/lib/errorTracking.ts by
-- src/lib/__tests__/systemNames.contract.test.ts — editing one without the
-- other fails that test, so this is a checked duplicate rather than a
-- remembered one.
-- ---------------------------------------------------------------------------

SELECT has_table(
  'public',
  'system_errors',
  'The error reporting sink exists'
);

SELECT has_column(
  'public',
  'system_errors',
  'system',
  'Errors are attributed to a reporting subsystem'
);

-- The two original values must keep working: widening the allowlist must never
-- invalidate rows already written by the timesheet and assignment paths.
SELECT lives_ok(
  $$INSERT INTO public.system_errors (system, error_type) VALUES ('timesheets', 'PgTapProbe')$$,
  'The original timesheets subsystem is still accepted'
);

SELECT lives_ok(
  $$INSERT INTO public.system_errors (system, error_type) VALUES ('assignments', 'PgTapProbe')$$,
  'The original assignments subsystem is still accepted'
);

-- 'ui' is what the React error boundary reports under. Without it, every
-- unhandled render crash silently fails to persist.
SELECT lives_ok(
  $$INSERT INTO public.system_errors (system, error_type) VALUES ('ui', 'PgTapProbe')$$,
  'The error boundary can report unhandled render crashes'
);

SELECT lives_ok(
  $$INSERT INTO public.system_errors (system, error_type) VALUES ('staffing', 'PgTapProbe')$$,
  'A domain subsystem can report through the sink'
);

-- The constraint is what keeps the table queryable by system: without it a
-- typo'd or caller-invented name fragments the data into one-off buckets.
SELECT throws_ok(
  $$INSERT INTO public.system_errors (system, error_type) VALUES ('not_a_subsystem', 'PgTapProbe')$$,
  '23514',
  NULL,
  'An unrecognised subsystem is still rejected'
);

-- Guards against a future migration widening the allowlist by dropping it.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'system_errors_system_check'
      AND conrelid = 'public.system_errors'::regclass
  ),
  'The subsystem allowlist constraint is present'
);

-- The live constraint against the canonical allowlist, compared as a set so
-- both a missing and an extra value fail.
--
-- Scope, stated precisely: this proves *migration -> live database*. It cannot
-- prove anything about the TypeScript `SystemName` union, because the array
-- below is hard-coded here and pgTAP cannot import TypeScript — both sides
-- could be wrong together and this would still pass. An earlier version of this
-- file claimed the stronger property in its assertion message, which is worse
-- than not testing it: it tells a future reader a contract has been verified
-- when it has not.
--
-- The TypeScript half is enforced separately, by
-- src/lib/__tests__/systemNames.contract.test.ts, which imports SYSTEM_NAMES
-- and parses the array below (and the migration's) to assert all three agree.
-- Chained with this assertion, that gives the real end-to-end property.
SELECT is(
  (
    SELECT array_agg(match[1] ORDER BY match[1])
    FROM pg_constraint c
    CROSS JOIN LATERAL regexp_matches(
      pg_get_constraintdef(c.oid),
      '''([^'']+)''::text',
      'g'
    ) AS match
    WHERE c.conname = 'system_errors_system_check'
      AND c.conrelid = 'public.system_errors'::regclass
  ),
  ARRAY[
    'assignments', 'auth', 'documents', 'equipment', 'festivals', 'flex',
    'jobs', 'logistics', 'staffing', 'timesheets', 'tours', 'ui'
  ],
  'The live constraint matches the canonical allowlist — no missing or extra values'
);

-- The widening lands as NOT VALID (20260904130000) and is validated by its
-- companion migration (20260904130500). Assert the pair completed: a NOT VALID
-- constraint still enforces new rows, so a half-applied rollout would pass
-- every other assertion here and only show up as a stale catalog flag.
SELECT ok(
  (
    SELECT convalidated
    FROM pg_constraint
    WHERE conname = 'system_errors_system_check'
      AND conrelid = 'public.system_errors'::regclass
  ),
  'The allowlist constraint has been validated, not left NOT VALID'
);

SELECT * FROM finish();
