# Campaign characterization on the historical local environment

This increment adds executable evidence for existing campaign behavior, without changing production handlers, migrations, counting, authorization or request vocabulary. It follows the [Phase 0 map](STAFFING_PHASE0_BEHAVIOR_MAP_2026-09-30.md), after [PR990's production rollout](PR990_PRODUCTION_ROLLOUT_2026-10-03.md).

## Reproduce

Start the private historical stack described in its local `README.md`, then run from the repository in PowerShell:

```powershell
./scripts/test-staffing-edge-local.ps1 -CredentialsPath C:/Users/Javi/AppData/Local/AreaTecnica/dev-history/status.env
```

The path contains local demo keys and remains outside Git. The runner restores its process environment afterward. The suite rejects hosted URLs, non-demo credentials, external routing, additional runtime/database/capture networks, and stale copies of the orchestrator, the separately invoked sender and their local dependency closure (18 modules). Ten regular unit tests exercise refusal paths, a matching-source positive control and cleanup after a surviving fixture row without touching Docker or a database. Three stale-sender cases failed against the original six-module gate and passed after expanding it. The activity-cleanup control failed against the original ordering and passed after moving cleanup before the remaining-job assertion.

The runtime suite uses real local GoTrue authentication, JWTs, Edge Runtime, Supabase JS, PostgREST, SQL RPCs, constraints and triggers. The original fetch transport is passed explicitly because the ordinary unit-test setup replaces global fetch before each test. Synthetic identities and jobs are owned by each run. Providers are captured inside the isolated network; no email/WhatsApp is delivered externally. Automatic availability waves are disabled, so no historical candidate is contacted. Automatic offer handoff uses only synthetic candidates.

Cleanup removes owned jobs, job-scoped activity records and synthetic users. Activity has no cascading job FK, so deletion explicitly covers it after job/assignment deletion and before checking whether any fixture job survived. Every user deletion is attempted even after another fails, and restoration checks still run. Before/after ordered row fingerprints cover jobs, staffing requests, assignments, timesheets, profiles and activity. Local Auth session/provider capture logs are not part of that comparison.

## Cases and observed contracts

The suite contains 27 actual-runtime cases:

- Management authentication for creation; technician/missing-auth denial; service-only tick.
- Assisted creation remains idle without a tick; auto creation immediately ticks with waves disabled. Start returns its pre-tick snapshot, so persisted state is checked separately.
- Invited membership counts as filled without schedules; declined membership does not. A completed campaign rejects further ticks.
- Pause and paused nudge do not tick; resume and active nudge do. Paused/stopped/completed resume synchronizes new required roles; active/failed resume is rejected.
- Fresh run locks reject ticks; stale locks and locks with no timestamp are reclaimed by direct tick. A real PostgreSQL role-row lock holds the winning tick while another actual runtime request receives 429. This is a held-lock interleaving, not two simultaneous initial compare-and-swap reads.
- The sweeper selector excludes a due stale-locked campaign. The same campaign is selected when unlocked, then direct tick recovers the stale lock. **CARLOS A3 remains unfixed**: sweeper selection prevents automatic crash recovery even though direct tick supports it.
- Offer direct role takes precedence over send-event metadata; availability uses the latest role-bearing send event. Repeated date rows count one profile, and missing role metadata does not create a role count.
- Latest availability role metadata drives a real automatic offer handoff through the sender. A same-job declined offer in another role blocks handoff; an expired-offer control permits it.
- Remaining offer capacity and response ordering select one earliest eligible profile, rather than counting date rows. A replay respects the pending offer reservation.
- Accepted offers without membership retain capacity across repeated ticks despite error events. Matching invited membership fills the role without double counting; expiring the offer or increasing demand permits another synthetic candidate's offer. These fixtures characterize recovery consequences, not the manager UI or an automatic retry policy.

The tests preserve the current odd outcomes. In particular, invited-as-filled and accepted-but-unassigned reservations are not silently corrected. Positive/negative fixture controls distinguish invited/declined, fresh/stale, locked/unlocked, direct/metadata role and declined/expired behavior. Independent review identified activity cleanup, all-user cleanup and an empty-selector false-positive gap; these were corrected before final verification.

## Limits and remaining roadmap work

The runtime suite is **opt-in local evidence**. Ordinary CI runs its ten safety/cleanup tests and reports these 27 cases as skipped; a skipped suite is not runtime verification. CI provisioning of an isolated Auth/Edge/capture stack remains separate work. The existing CI PostgREST acceptance/lock and pgTAP suites continue unchanged.

This closes the named controls/counting/handoff/recovery slice, not the entire Phase 1 exit gate. Still missing here: automatic availability-wave ranking/size/deterministic keys and cross-job decline selection (P1.1/10/12), two simultaneous initial CAS contenders (P1.7), exact completion-push count/failure controls (P1.14), real manager cancellation (P0.13), and real direct matrix persistence (P0.14–17). Full GET-versus-POST behavior (P0.21), TTL/cancellation semantics, failure fencing and transactional capacity/conflict checks remain later boundaries. No stale-lock recovery or other production behavior is changed by these tests.

Rollback is removal/reversion of the test harness, runner and documentation. No production database push or Edge Function deployment is required for this increment.

## Validation on 2026-10-03

The final isolated runtime run passed all 27 cases, including the six-table preservation check after cleanup. The ordinary suite passed 3,253 tests and skipped 50 opt-in cases (27 new runtime cases plus 23 existing PostgREST/lock cases). Ten new safety/cleanup tests also passed independently. Lint passed with zero errors and the existing 296 warnings; application typecheck, governance and build passed. After each source-gate/cleanup review fix, changed-file lint, application typecheck, the full ordinary suite and all 27 runtime cases passed again. CI and review results are recorded in the follow-up PR.
