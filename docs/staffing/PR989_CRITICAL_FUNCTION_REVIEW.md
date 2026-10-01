# PR989 critical staffing function review

Review date: 2026-10-02. Scope: `send-staffing-email` and `staffing-click`, their local date/persistence helpers, and matrix resend callers. No migration, RLS, RPC, rate calculation or production deployment changes.

## Roadmap boundary

Read `STAFFING_PHASE0_BEHAVIOR_MAP_2026-09-30.md`, especially sections 13–15. PR985 supplies Phase 1 characterization; subsequent main fixes restore ranking filters and fail-closed send verification. This PR is the user's requested date-consent correction, not completion of the staffing overhaul or its Phase 1 exit gate.

Preserved outcomes have executable handler checks: availability confirmation never assigns; request persistence precedes delivery; failed delivery retains pending requests; an idempotency replay does not redeliver; response confirmation precedes assignment; assignment/timesheet/Flex failure does not roll back that response; an already declined request cannot be changed through a sequential repeated link. All eight preserved-contract tests also passed against the original PR handlers at `c103411467a841edab6da1dddb82106470ed0494`.

Intentional changes: new whole-job solicitations freeze canonical Madrid work dates as existing per-day batch rows; existing confirmed active dates are excluded; accepted dates append without rewriting membership date fields or approved prep data. Added job dates need a new staffing cycle. Pending resends identify the original request and retain its exact pending batch, role and row identities. Supplied credentials must match stored hashes, and query expiry cannot extend stored expiry.

## Independent Astra review and corrections

The configured `ocx-gpt-6-astra` reviewer performed read-only adversarial review after the native Astra route exhausted retries. The review corrections have executable regression coverage:

- Legacy whole-job resends could leave a second broader active link. Preserve the original row and freeze its existing successful delivery snapshot. If no historical dates exist, the first successful resend freezes current canonical work dates; the original historical span cannot be reconstructed.
- Matrix resend used a clicked single date for a multi-date pending batch. Carry `resend_request_id` through desktop/mobile and resolve the pending batch on the server.
- Path links could authenticate through a recomputed current HMAC without matching the supplied old token. Match the supplied token hash and rotate credentials on every pending batch member.
- Delivery event write failures could lose legacy date consent. Persist and verify a mandatory `request_scope` event before refreshing credentials/delivering.
- Concurrent snapshot writers could choose different consent dates by timestamp order. A deterministic existing event primary key elects one immutable scope; a loser with different dates/role returns 409 before refreshing credentials. Retry reads the winning scope and reruns send guards.
- A rejected conflict check could previously create a snapshot. Scope resolution is read-only; snapshot persistence follows all conflict guards.
- Cancellation between lookup and persistence could recreate a batch. Explicit resends require the original pending IDs, including at the credential update.
- Two resends could restore an older credential on only the batch head. The final write changes only idempotency metadata and requires the expected hash/expiry; the superseded resend returns 409 without delivery. The controlled interleaving failed before the correction and now passes both in-memory and through actual HTTP database writes.
- Legacy resend could silently change the original role. A changed role requires cancellation/new offer; omitted roles retain the original.

The initial seven resend regression cases failed against `11e966b3` without these review corrections. The assignment metadata negative control (updating deprecated scope columns) failed four real pgTAP assertions.

Final Astra closure: independently replayed the superseded-resend race (A 409, B 200, one batch hash), reran 28 focused tests, and reported no remaining introduced blockers within this scope. The reviewer did not rerun the mutating real-DB suites; those were independently executed by the orchestrator. This is review evidence, not a zero-risk guarantee.

## Evidence and its limits

`preservedMutationContracts.test.ts`, `resendCoverage.test.ts`, `clickCredentialCompatibility.test.ts`, and desktop/mobile `staffingResend.integration.test.tsx` execute actual handlers, with an in-memory PostgREST boundary and stubbed external services. Scope concurrency, cancellation, failed writes and old query/path links are exercised explicitly.

`staffing-postgrest.integration.test.ts` additionally runs seven cases through actual Supabase JS HTTP/PostgREST, PostgreSQL RPCs, constraints and triggers on a disposable database with all 249 current migrations applied. The cases cover extension after send, unchanged approved prep rows, legacy resend and retired WhatsApp credentials, batch-member resend, declined repeated clicks, concurrent competing scope inserts, and interleaved credential rotations. It clicks the actual delivered email URLs, avoiding timestamp normalization artifacts from re-signing fetched rows.

Actual pgTAP checks passed: staffing state (41), assignment lifecycle (18), staffing RLS (19), and date coverage (14): 92 assertions. The new coverage fixtures roll back and use IDs separate from existing characterization fixtures.

The HTTP suite mocks authentication/rate-limit boundaries and external email/WhatsApp/Flex/push services. It uses local `service_role`; it does not replace RLS tests or verify real delivery. The database has no outbound network. The suite is opt-in and skipped by default; the new pgTAP file runs in the normal database CI suite. No claim of zero regression risk or complete overhaul readiness follows from these checks. Existing acceptance/capacity races and partial-commit failure outcomes outside this requested date fix remain roadmap work.

Local validation after the review corrections: full Vitest suite 512 files / 3,223 tests passed (7 opt-in database cases skipped and separately passed); critical suites 140 + 71 passed; desktop/mobile matrix/tab-return Playwright 11 passed / 3 viewport skips. App/Edge lint, application typecheck, governance, build and bundle budget passed; CI-pinned Deno checked all 102 function modules. The first full test run overlapped several heavy checks and timed out in an unrelated file-size test; the complete rerun with `--maxWorkers=2` passed.

## Reproduce the real database checks (PowerShell)

Use a new disposable Supabase project directory, never the linked/user's existing stack. Docker and Node are required. The local review used Supabase CLI 2.107.0, its PostgreSQL 15 bootstrap and PostgREST 14.13. Create a temp config with `project_id = "pr989staffingreview"`, database port 54342/major 15, API port 54341, and both `[db.migrations] enabled = false` and `[db.seed] enabled = false` for bootstrap. Then:

```powershell
$reviewDir = Join-Path $env:TEMP 'pr989-staffing-sandbox'
npx --yes supabase@2.107.0 start --workdir $reviewDir --exclude 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'
docker network create --internal pr989-review-network
docker network connect pr989-review-network supabase_db_pr989staffingreview
docker network disconnect supabase_network_pr989staffingreview supabase_db_pr989staffingreview
# Sandbox DDL bootstrap only; HTTP still uses service_role.
docker exec -e PGPASSWORD=postgres supabase_db_pr989staffingreview psql -U supabase_admin -d postgres -c 'ALTER ROLE postgres SUPERUSER'
docker cp supabase/migrations supabase_db_pr989staffingreview:/tmp/pr989-migrations
foreach ($migration in (Get-ChildItem supabase/migrations/*.sql | Sort-Object Name)) {
  docker exec -e PGPASSWORD=postgres supabase_db_pr989staffingreview psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d postgres -f "/tmp/pr989-migrations/$($migration.Name)"
  if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($migration.Name)" }
}
docker cp tests/assignments/fixtures/staffing-postgrest.sql supabase_db_pr989staffingreview:/tmp/staffing-postgrest.sql
docker exec -e PGPASSWORD=postgres supabase_db_pr989staffingreview psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/staffing-postgrest.sql
docker run --detach --name pr989-review-rest --network bridge -p 127.0.0.1:18089:3000 -e PGRST_DB_URI=postgres://authenticator:postgres@supabase_db_pr989staffingreview:5432/postgres -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=service_role -e PGRST_SERVER_PORT=3000 public.ecr.aws/supabase/postgrest:v14.13
docker network connect pr989-review-network pr989-review-rest
$env:STAFFING_TEST_REST_URL='http://127.0.0.1:18089'
npx vitest run tests/assignments/staffing-postgrest.integration.test.ts
Remove-Item Env:STAFFING_TEST_REST_URL
docker cp supabase/tests/database supabase_db_pr989staffingreview:/tmp/pr989-db-tests
foreach ($testFile in @('staffing_state_contracts.sql','staffing_assignment_lifecycle_characterization.sql','staffing_rls_characterization.sql','staffing_date_coverage.sql')) {
  docker exec -e PGPASSWORD=postgres supabase_db_pr989staffingreview psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/pr989-db-tests/$testFile"
  if ($LASTEXITCODE -ne 0) { throw "SQL failed: $testFile" }
  # Inspect TAP: every plan must complete with zero `not ok` assertions.
}
```

The fixture suite deletes only jobs titled `Disposable staffing review` at its strictly permitted loopback endpoint. Run it only against this disposable stack. Stop/remove only these review containers and networks afterward; preserve unrelated local Supabase stacks.

## Human deployment and rollback

Merging deploys the frontend only. Edge Functions are manual. From the reviewed merged revision, dispatch **`staffing-click` alone**, wait for success, then dispatch **`send-staffing-email` alone**. The older sender works with the new click handler; the older click handler can overwrite assignment date metadata when used with new batches. Do not use `all`: its alphabetical order deploys sender first. Even a two-slug ordered dispatch continues after an individual failure, so two successful sequential dispatches are preferable.

Rollback reverses the order: restore the prior **sender first**, then restore the prior **click handler** if necessary. Revert frontend code separately. No schema rollback or production database push is required. Existing frozen request rows/data should not be deleted as an automatic rollback. A maintainer must deliberately review the changed confirmation path and monitor an availability → offer → confirmation cycle (including extended dates and prep) after deployment. No production deployment or merge was performed during this review.
