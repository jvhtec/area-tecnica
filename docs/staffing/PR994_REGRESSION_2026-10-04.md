# PR #994 local regression evidence — 2026-10-04

## Verdict and scope

The initial local regression checks passed for PR #994's production changes at
`f9b130f6d1e4ab8ac39717cd98c1e224345a8974`, with the accompanying test-harness
corrections. The later manually requested CodeRabbit review retained two security
architecture blockers despite green CI. Both were reproduced: missing-profile
authorization passed nullable guards, and old Flex intents reversed newer crew
decisions. The subsequent reconciliation follow-up changes production handlers
and adds two migrations; its evidence is recorded below. Runtime admission and
cleanup safeguards remain unchanged.

The final merge and production migration application remain human actions.
Check the current PR checks/review threads before merging. Follow
`ASSIGNMENT_COMMANDS.md` and the production release checklist for the production
role inventory, Edge deployment order, linked dry-run, migration apply, and
deliberate second review.

## Observed checks

| Check | Result |
| --- | --- |
| Clean `supabase db reset --local --no-seed` | All 256 migrations applied |
| `supabase db lint --local --fail-on error --schema public,auth` | Passed; existing warnings remain |
| `supabase test db supabase/tests/database` | 60 files, 1,433 assertions passed |
| Real PostgREST rollback and concurrent SQL backends | 31 tests passed; includes all 8 direct-assignment races |
| Full synthetic runtime | 44 passed, 0 skipped; owned teardown passed |
| Runtime controller safety controls | 88 Python tests passed |
| `npm run test:run` | 535 files passed; 3,655 tests passed, 103 opt-in tests skipped |
| `npm run test:critical` | Passed, including critical coverage thresholds |
| `npm run lint`, `typecheck`, `typecheck:functions`, `governance` | Passed; all 102 Edge modules checked |
| `npm run build`, `npm run budget:bundle` | Passed |
| Strict standalone TypeScript check of the tracker and its unit tests | Passed |

The opt-in SQL and synthetic suites above were run separately with their actual
database/runtime admission enabled. Their case counts overlap existing product
contracts; they should not be summed into a count of distinct behaviors.

The runtime command was:

```bash
python3 -B scripts/ci/run-staffing-runtime.py \
  --root <fresh-private-root-on-the-Docker-readable-filesystem> \
  --checkout <absolute-linux-git-checkout> \
  --cli <absolute-Supabase-2.107.0-shim-with-its-companion-binaries> \
  --node /usr/bin/node --base-port 56040
```

The four runtime suites passed 6 protocol, 27 campaign, 8 matrix-persistence,
and 3 matrix-fault/authorization cases. The final run certified teardown and
removed its owned containers, networks, and volumes.

For SQL concurrency, a separate fresh database was created under the legacy
permitted test identity `pr990staffingreview`; no pre-existing container was
replaced. Its only REST ingress was `127.0.0.1:18089`. With the reviewed
`staffing-postgrest.sql` fault fixture installed, the command was:

```bash
STAFFING_TEST_REST_URL=http://127.0.0.1:18089 \
STAFFING_TEST_DB_CONTAINER=supabase_db_pr990staffingreview \
ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL=supabase_db_pr990staffingreview \
npx vitest run tests/assignments/staffing-postgrest.integration.test.ts \
  tests/assignments/staffing-removal-locks.integration.test.ts \
  tests/assignments/direct-assignment-commands.integration.test.ts \
  --maxWorkers=1 --no-file-parallelism
```

## Populated upgrade and preservation

The historical local database was read only. Its application table and
assignment-function definitions matched a replay through `20261002105500`.
Pre-existing differences were observed in 217 relation grants, one default
grant, and the unrelated festival-gear RPC
`save_festival_stage_gear_setup(uuid,integer,jsonb)`. These differences were
not repaired or represented as production findings.

Its public-table data and Auth users were copied into a separate database
replaying that baseline. Auth user columns were verified identical. Extra
tables from the historical stack's newer Auth service were excluded; this
was an application-data upgrade test, not an Auth-service migration test.
Restore triggers were disabled only for that isolated data import and restored
before applying the five PR migrations.

The clone's local dry-run listed exactly the five assignment migrations. They
applied successfully, reaching `20261003214000`. Before/after sorted whole-row
hashes matched for:

| Dataset | Rows | Preserved |
| --- | ---: | --- |
| Jobs | 1,187 | Yes |
| Assignments | 3,070 | Yes |
| Timesheets | 5,857 | Yes; includes 2,038 approved and 121 inactive rows |
| Profiles | 327 | Yes |

The same source hashes were unchanged after the run. An additional copy of the
smaller development database also upgraded successfully from 246 to 256
migrations, preserving its 10 jobs, 5 assignments, 5 timesheets, and 26 profiles.
An additional transaction against an actual approved historical assignment
returned `approved_timesheet` for whole removal, then rolled back without
changing the copied records.

## Legacy-role rollout finding

The documented legacy-role query returned 18 role entries in the historical
snapshot. Some use free-text/unknown codes; others disagree with the profile's
current department. They will refuse role edits/modifications until corrected,
as specified by this PR; removal remains available. This is historical local
data, not a verified production count. Run the query from
`ASSIGNMENT_COMMANDS.md` against production and review the affected entries
before deployment. No source records were modified during testing.

## Test-harness corrections and negative controls

The initial actual runtime exposed an early drain: matrix assertions inspected
notifications while the side-effect claim RPC was still pending. The tracker
now observes the SDK's existing RPC consumption and drains claim → function
invocation → ledger-report chains, without re-executing a request. SQL denials
remain completed outcomes; transport failures still refuse cleanup. Three new
unit cases cover the delayed chain, SQL denial, and RPC transport failure.
The delayed-claim case failed against the original helper before the fix.

The fault suite now reuses the tracker RPC spy and reads already-consumed
responses. Its previous independent spy interfered with tracking; awaiting its
returned PostgREST builders also risked issuing the RPCs again. The final real
fault case reached the injected `P0001` error and verified no membership,
no scheduled day, no success notification/event, and an open dialog.

Early provisioning failures and the first uncertain runtime were retained
outside Git for diagnosis. Ownership, completion, provider isolation, and
cleanup-refusal controls were preserved. Windows Node 22.12.0 was below some
dependency minimums; the successful runs used Ubuntu/WSL Node 22.19.0 and pinned
Supabase 2.107.0. A proper Linux Git checkout avoided Windows export line endings
and supplied the Git index required by the assignment-writer inventory.

## Limits

No production database or real email/WhatsApp/Flex delivery was exercised.
Providers were isolated behind the synthetic sink. The later local production-build
Chromium run passed 52 browser tests with 10 skips; matrix runtime tests exercised real
Auth/RLS/SQL through jsdom. No physical device was exercised. The production linked
dry-run, role inventory, migration apply, merge, and post-deploy verification
remain required human release steps.

## Reconciliation and authorization blocker follow-up

The manually requested CodeRabbit review through `14d67f3` retained two
architecture concerns. Independently reproduced negative controls confirmed
both: all 42 missing-identity denial cases failed against the original nullable
guards, and two historical Flex retries reversed newer opposite decisions while
their two current-intent controls passed.

The additive authorization migration fails closed at all 14 assignment boundary
RPCs while preserving their signatures, grants and unrelated role helpers. The
second migration provides a service-only, non-expiring physical-element gate.
Both crew endpoints reconcile current explicit roles through one coordinator.
Every external write is admitted durably; verified add settlement persists its
local ownership mapping atomically. Uncertain outcomes retain ownership without
lease takeover. The proxy positively classifies permitted equipment/financial
operations and refuses alternate crew membership/role writes. Job deletion
removes core membership before requesting crew reconciliation.

Observed additional checks:

| Check | Result |
| --- | --- |
| Fresh migration replay and database lint | All 258 migrations applied; lint passed |
| Full pgTAP suite | 62 files, 1,522 assertions passed |
| Missing identity authorization | 47 assertions passed; 42 denial assertions fail without the fix |
| Real PostgREST and SQL concurrency | 38 passed, including 7 new Flex cases |
| Shared reconciliation coordinator | 69 focused tests passed |
| Generic proxy compatibility and bypass tests | 115 passed |
| HTTP adapters | 13 passed; legacy intent is not forwarded, bulk shares the coordinator, missing profiles denied; unmapped calls skip without provider access and lookup failures remain errors |
| Full synthetic runtime rerun | 44 passed, 0 skipped; owned teardown certified |
| Populated historical upgrade | Seven PR migrations applied from 251 to 258; all four whole-row hashes unchanged |
| Historical approved timesheet probe | Removal rejected as `approved_timesheet`, then transaction rolled back |
| Final lint, app typecheck, Edge typecheck and governance (2026-10-05) | Passed; 104 Edge modules checked |
| Full unit suite | 538 files, 3,852 tests passed; 110 opt-in tests skipped and exercised separately where relevant above |
| Critical suite and coverage thresholds | Passed |
| Production build and bundle budget | `npm run build` and `npm run budget:bundle` passed |
| Local production-build Chromium suite | 52 passed, 10 skipped; missing browser binary/libraries repaired before the successful run |
| Local production-build mobile viewport suite | 60 passed, 2 skipped, including touch-only Matrix flows |

The final Edge type check caught callback control-flow narrowing in the added
contact tracking. Ownership tracking now occurs inside the verified-contact
callback; focused runtime tests and all 104 Edge type checks pass after that fix.
The security advisor reported 19 pre-existing warnings and none for the new gate.

The new real integration cases execute the actual retry path through the shared
coordinator and real service RPCs with a simulated Flex provider. They cover both
superseded intents and current controls, a paused add followed by newer removal,
independent claim backends on physical aliases, and retargeting while mapping.
The retarget case observes a genuine row-lock wait and refuses the obsolete
physical mapping after the competing transaction commits.

Additional negative controls disable the pre-admission outstanding flag and
atomic add settlement separately; both tests fail as expected, then pass after
restoration. Late provider completion, HTTP 408, failed/ambiguous mapping
settlement, cascading source deletion and response-body hangs cannot release
uncertain external ownership.

The final independent review reproduced another combined failure: a successful
add, cascading source/mapping deletion, then a failed projection could release
ownership and let a retry forget the provider contact. Its regression failed
before the fix. A durable gate contact journal now survives cascades, is read by
reconciliation and cannot be discarded by error cleanup. Two timing tests cover
cascade before the first read and cascade followed by read failure; pgTAP verifies
durable persistence, refused error release and blocked replacement. The independent
recheck passed all 69 helper tests with no remaining finding in that narrow review.
Errors with journaled contacts conservatively retain busy ownership for recovery,
even if an individual provider operation was settled.

CodeRabbit completed review `a1ab7095-8ac5-44c6-b202-9606d4c895fb`
through `319e5db9`, with no architecture-level concern and two bounded findings.
Single and bulk adapters now skip absent/empty physical mappings; lookup errors
still fail visibly, and mapped calls retain the durable coordinator. Thirteen
adapter tests pass; six new assertions fail with the original adapters while
seven controls pass. No gate or journal is cleared by the unmapped-call skip.

The seven real Flex integration cases now accept a configured loopback endpoint
and an explicitly permitted container, or the known disposable GitHub Actions
target. The CI database integration step includes them. On a new owned target
`supabase_db_pr994reviewfollowup` at port 18090, all seven real cases and thirteen
adapter cases passed with zero skips. The old fixed gate skipped all seven cases
on that same target. Two older staffing suites refused its different name/port
as designed; their original 38-case validation remains recorded above. Lint,
app/Edge type checks, governance, critical and the full unit suite were rerun
after these changes. Public command contracts and coordinator/proxy safety
helpers gained 58 JSDoc comments to address the review's documentation warning.

The first follow-up runtime passed 41 cases and two of the three fault cases,
but its positive fixture lacked a crew-call scope. It now provisions an owned
scope explicitly. A technician without a resource and without existing mappings
requires no provider read/write; this safe skip still validates the final source
token. The complete rerun passed and removed only its certified owned target.

The historical-copy upgrade preserved 1,187 jobs, 3,070 assignments, 5,857
timesheets and 327 profiles again. The source hashes also remained unchanged;
the private data dump was removed after the isolated comparison. No source
record, production database, real Flex request or actual delivery was modified.

Readiness still requires a fresh completed CodeRabbit review through the final
HEAD, current CI across all workflows, zero unresolved threads and current main.
Production inventory, linked migration dry-run/application, old-worker drainage,
deliberate maintainer review, final merge and production verification remain
human release steps. Provider classification relies on the repository's known
Flex definition IDs and key-info/row-data formats; live Flex compatibility was
not exercised. Unknown or conflicting metadata fails closed.
