-- =============================================================================
-- Observability: validate the widened `system_errors.system` allowlist
-- =============================================================================
-- Companion to 20260903120000_widen_system_errors_systems.sql, which added
-- `system_errors_system_check` as `NOT VALID` so the widening would not scan
-- the table under ACCESS EXCLUSIVE and block the very error writes it exists
-- to enable.
--
-- `NOT VALID` only defers the check on rows that already existed; every insert
-- and update since that migration has been enforced. This statement completes
-- the rollout by scanning those pre-existing rows and clearing `convalidated`,
-- so the catalog reflects reality and a future reader is not left wondering
-- whether the table holds values the constraint forbids.
--
-- `VALIDATE CONSTRAINT` takes SHARE UPDATE EXCLUSIVE, which does not conflict
-- with the ROW EXCLUSIVE lock an INSERT takes — error reporting keeps working
-- while this runs. It is kept in its own migration deliberately: in the same
-- transaction as the `ADD`, the ACCESS EXCLUSIVE lock from that statement
-- would still be held to commit and the separation would buy nothing.
--
-- The scan cannot fail. The constraint this replaced admitted
-- ('timesheets', 'assignments'), a strict subset of the new allowlist, so
-- every pre-existing row already satisfies it.
-- =============================================================================

-- Bounded on both axes. `lock_timeout` caps how long we wait for the (weak)
-- SHARE UPDATE EXCLUSIVE lock; `statement_timeout` caps the row scan itself, so
-- an unexpectedly large table cannot hold that lock — and block other DDL —
-- indefinitely. 60s is generous for an append-only error log; if it is ever hit,
-- that is information worth having rather than a deploy to wait out.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "public"."system_errors"
  VALIDATE CONSTRAINT "system_errors_system_check";
