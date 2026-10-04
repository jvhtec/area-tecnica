# PR #994 local regression evidence — 2026-10-04

## Verdict and scope

Local regression checks passed for PR #994's production changes at
`f9b130f6d1e4ab8ac39717cd98c1e224345a8974`, with the accompanying test-harness
corrections. No production handler, migration, authorization rule, or runtime
admission/cleanup guard was changed by this follow-up.

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
Providers were isolated behind the synthetic sink. Browser/mobile smoke tests
are covered by the PR's GitHub checks; the local matrix tests exercised real
Auth/RLS/SQL through jsdom, rather than a physical device. The production linked
dry-run, role inventory, migration apply, merge, and post-deploy verification
remain required human release steps.
