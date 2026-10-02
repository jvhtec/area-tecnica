# Phase 2A atomic offer acceptance — PR990 review

Reviewed against `origin/main` at `09a58c4b` (PR989 merged), on 2026-10-02, Europe/Madrid. This is a high-risk database change. A maintainer must deliberately review the final diff and run the production migration dry-run before merging. No production migration, function deployment, merge or approval was performed by this review.

## Roadmap contract decision

The [Phase 0 behavior map](STAFFING_PHASE0_BEHAVIOR_MAP_2026-09-30.md), sections 14–16, requires characterization before changing a boundary and asks whether one transaction should own assignment and timesheet creation. PR990 implements that narrow boundary for accepted offers. It does not consolidate direct assignment writers or complete the staffing overhaul.

The intentionally changed P0 case is **9: timesheet upsert failure after assignment creation**. `preservedMutationContracts.test.ts` previously expected the membership to remain; it now expects no new membership and no new schedule. An existing membership, its metadata and trigger effects also roll back if any schedule write fails. `staffing-phase1-characterization.test.ts` now identifies one command after the committed response instead of separate membership and schedule writes. Actual SQL and HTTP tests verify that command rather than relying on source inspection or the in-memory transaction fake.

The response still commits first. Conflict or persistence failure therefore retains a confirmed offer with no successful assignment. The user-facing response continues to acknowledge the recorded response, as before. This phase does not redefine a confirmed offer as guaranteed assignment success.

The following contracts remain: availability does not assign; sender persistence precedes delivery; request vocabulary, campaign filled-count semantics and role scoping are unchanged; active timesheets remain date-level coverage; offered date consent stays frozen; existing confirmed membership scope stays intact; dryhire skips timesheets; tourdate creates schedule-only rows; Flex remains best-effort outside the transaction. Assignment success events, assignment push and Flex are issued only after the RPC succeeds. The earlier response notification remains outside and before that command.

Only the production `staffing-click` Edge Function changes in this PR. Sender changes are confined to the shared test harness. The additive `assign_staffing_offer` RPC is invoker-security and executable only by `service_role`; the handler retains responsibility for credential verification, accepted dates and the existing conflict check.

## Independent review and reproduced corrections

Luna audited the roadmap and test coverage. Astra independently reviewed the critical SQL/handler boundary; the targeted corrections were sent back for a closure review. Model conclusions were checked against actual handlers and PostgreSQL; they are not a guarantee of zero regressions.

- CI initially stopped after ten assertions because four rollback-test references contained a malformed UUID. Corrected fixture IDs allow the remaining tests and subsequent HTTP suite to execute.
- A losing simultaneous click rendered “Error al guardar respuesta” after the winning click committed confirmation. Both single-date and batch HTTP reproductions failed with one success redirect and one error page. The loser now re-reads the durable status and shows the already-recorded or expired result; real read/write errors retain the error path.
- The SQL conflict update omitted columns that previously fired category and prep pricing update triggers. Real SQL reproduced an existing draft retaining a null category and an inactive prep row retaining €321 instead of €120 for eight hours. The RPC fills only missing categories from the existing insert/category trigger result and invokes the canonical prep pricing trigger for accepted, unapproved prep rows with hours. It does not redefine any rate calculation.
- No-op schedule replays now avoid updates. Tests verify an already active approved prep row remains byte-for-byte unchanged, including its version. Seasonal house-tech acceptance uses the existing overtime rule: sixteen hours, four hours above twelve, €30 custom hourly rate, €120 total. Profile changes and a later acceptance leave the previously approved prep row unchanged.
- Real HTTP coverage also verifies a booking created after send blocks assignment, assignment-write failure retains the response without coverage, and an attempted Flex call returning 503 leaves committed membership and coverage intact. Assignment failure does not attempt Flex or emit the assignment-success event.
- The CI HTTP helper refuses local execution before installing destructive fixtures. The fixture is installed after authorization tests in CI, so its service-only fault triggers cannot contaminate authenticated/anonymous tests.

## Verification and reproduction

Focused handler/characterization coverage: 151 tests. Actual atomic pgTAP coverage: 42 assertions, including anonymous/authenticated execution denial, rollback, replay, exact date coverage, category filling, prep and seasonal rates, approved data, dryhire and tourdate. Actual PostgREST handler coverage: 17 cases, including controlled pending-read, confirm/decline races and overlapping-RPC interleavings. The negative controls above failed on the original PR990 code before the corrections.

The HTTP suite executes Supabase JS against real PostgREST, constraints, RPCs and triggers, but stubs authentication/rate limiting and email/WhatsApp/push/Flex. It proves failure handling, not delivery by real external services. Full database authorization tests exercise actual caller roles separately.

For local reproduction, follow the disposable project procedure in [PR989's review](PR989_CRITICAL_FUNCTION_REVIEW.md#reproduce-the-real-database-checks-powershell), substituting `pr990staffingreview` / `pr990-review-network` / `pr990-review-rest` and replaying all current migrations. Use a new isolated database, never the user's linked stack. Restore `postgres NOSUPERUSER` after the sandbox-only DDL bootstrap. Run pgTAP **before** installing `tests/assignments/fixtures/staffing-postgrest.sql`, then run the HTTP suite with `STAFFING_TEST_REST_URL=http://127.0.0.1:18089`. The database has no outbound network. Inspect TAP plans and failures, not only psql exit codes. A full-suite local replay additionally needs the exact `20260905094349` migration SQL recorded in the migrator ledger for its populated-upgrade test; CI creates that ledger through the normal migrator.

CI runs both real suites in the RLS/RPC job. Local validation commands are `npm run lint`, `npm run typecheck`, `npm run typecheck:functions` with CI-pinned Deno 2.9.4, `npm run governance`, `npm run test:critical`, `npm run test:run -- --maxWorkers=2`, `npm run build`, and `npm run budget:bundle`. Final results and reviewed commit are recorded in the PR description.

Observed local results: full pgTAP suite 54 files / 1,257 assertions passed on a fresh replay of all 250 migrations; all 17 HTTP cases passed afterward. Full application suite 3,233 tests passed; critical suites 140 + 71 passed; matrix/tab-return Playwright passed 11 desktop/mobile cases with three viewport skips. Lint, application typecheck, governance, build and bundle budget passed; CI-pinned Deno checked all 102 function modules. Existing lint/build warnings remain. The first full DB attempt installed HTTP fault triggers too early, contaminating role-based tests; the successful fresh run followed CI's authorization-before-HTTP ordering.

## Remaining roadmap work and operational limits

The advisory lock serializes this RPC's job/technician pair. Direct assignment writers do not share that lock; the pre-existing missing-row/upsert scope race with those writers is not solved here. Conflict and capacity checks are not transactional across different jobs or technicians. Request cancellation, campaigns, lifecycle removal, external retries and their wider P0/P1 cases remain separate roadmap boundaries. This report does not claim every Phase 1 exit criterion is completed.

Confirmed responses whose assignment fails still require management follow-up. Repeating the answered link does not retry assignment. The prior manual recovery path remains; no retry/outbox protocol is introduced.

## Human rollout and rollback

From the reviewed revision: run production `supabase db push --linked --dry-run`, review it, apply the additive migration, then deploy **`staffing-click` alone**. The migration must exist before the new handler is deployed. The older handler continues to work while the new RPC is unused. PR989's sender deployment, if still pending, follows its separate click-before-sender sequence; merging a frontend PR does not establish that Edge Functions have been deployed.

Rollback the handler to the prior reviewed revision; leave the unused service-only RPC in place. This restores the old partial-write behavior. Revert application/test changes separately if needed. Do not delete historical staffing data or drop the RPC while a deployed handler can still call it. Any data correction requires a reviewed forward migration. A maintainer should verify one availability → offer → confirmation cycle with extended dates and prep after deployment.
