-- =============================================================================
-- Observability: widen the `system_errors.system` allowlist
-- =============================================================================
-- `public.system_errors` (00000000000000_production_schema.sql) is the only
-- server-side sink the browser has for error context: `trackError`
-- (src/lib/errorTracking.ts) redacts and sanitizes a failure, then inserts it
-- here for admin/management to query.
--
-- The table was introduced alongside the timesheet and assignment reliability
-- work, so `system_errors_system_check` admits exactly two values. That
-- constraint — not the application — is what has kept the sink narrow: any
-- other subsystem that tried to report through `trackError` would have its
-- insert rejected at write time, so the client kept the `SystemName` union
-- pinned to the same two values and every other failure path fell back to
-- `console.*`, which the production build strips (`drop: ['console']` in
-- vite.config.ts). The practical effect is that a crash outside timesheets and
-- assignments leaves no server-side trace at all.
--
-- This widens the allowlist to the app's actual subsystems so `trackError` can
-- be adopted beyond those two, most importantly by the React error boundary
-- ('ui'), whose crash records currently never leave the browser's
-- sessionStorage (src/utils/errorTelemetry.ts).
--
-- The constraint is kept rather than dropped: it is what stops a typo'd or
-- caller-invented system name from fragmenting the table into unqueryable
-- one-off buckets. Widening it stays a deliberate, reviewed change.
--
-- No data migration is required — every existing row holds 'timesheets' or
-- 'assignments', both of which remain valid, so this only ever loosens what is
-- accepted. RLS and grants are unchanged.
-- =============================================================================

ALTER TABLE "public"."system_errors"
  DROP CONSTRAINT IF EXISTS "system_errors_system_check";

ALTER TABLE "public"."system_errors"
  ADD CONSTRAINT "system_errors_system_check"
  CHECK ("system" = ANY (ARRAY[
    -- Pre-existing values. Kept first so the diff against the baseline schema
    -- reads as a pure addition.
    'timesheets'::"text",
    'assignments'::"text",
    -- Cross-cutting: unhandled render errors caught by ErrorBoundary.
    'ui'::"text",
    -- Domain subsystems, matching the feature areas in src/.
    'auth'::"text",
    'jobs'::"text",
    'tours'::"text",
    'festivals'::"text",
    'staffing'::"text",
    'equipment'::"text",
    'logistics'::"text",
    'documents'::"text",
    'flex'::"text"
  ]));

COMMENT ON CONSTRAINT "system_errors_system_check" ON "public"."system_errors" IS
  'Allowlist of subsystems permitted to report through trackError(). Widen deliberately: the constraint is what keeps this table queryable by system.';
