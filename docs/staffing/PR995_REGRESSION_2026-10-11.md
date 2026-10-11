# PR #995 regression and fixes — 2026-10-11

The matrix findings from `PR995_REVIEW_2026-10-05.md` have been addressed in the isolated review checkout. This candidate preserves author HEAD `00c089ac81a846724c2acd490ab78cb7e19fd9bb` and final #994 `31cfdfc87ce543dfaa30197c4b8617c1cc7fd6d5`. It is **not yet merge-ready**: the current dependency audit fails, full GitHub checks are absent on the stacked target, and actual CodeRabbit review coverage has not been established.

## Resulting behavior

- An uncertain command retains its original ID, expected tokens and intent. Identical concurrent requests share one operation. Replays reconcile the cache without repainting an older decision.
- Failed optimistic writes restore only their own pair, provided the prediction still owns those rows. Concurrent successful pairs, refetches and recreated queries survive rollback.
- Conflict approval is tied to the exact rejected staffing packet. Editing job, phase, coverage, channel, role or message invalidates it; late failures cannot resurrect approval.
- Decline opens the v2 inspector before changing the grid. An operation can close only its own inspector generation. Batch actions use a synchronous busy guard, and ambiguous offers retain the selected job, dates, channel, department and message when choosing a role.
- Focus assignment reserves role capacity until the authoritative grid or staffing membership catches up. Realtime changes invalidate command-state and staffing-summary queries.
- `20261005120000_verified_assignment_undo.sql` adds an authoritative eight-second ledger hold, author/service-only release and atomic verified undo. Undo validates the stored prior token and current decision, refuses any previously claimed effects, restores the exact prior projection, links the inverse and cancels both plans in one transaction. Late reports preserve terminal supersession. The prior author migration remains unchanged.
- A status-only apply upgrade derives an unconfirm inverse. Changes to role, coverage, other membership fields or dates that cannot be restored by one inverse remain refused. A committed inverse replays before profile locks; transient lock errors leave the same client retry packet available.
- Release remains available after expiry and for commands without a hold; verified cancelled relationships refuse delivery. Generated Supabase types were regenerated from the owned database, including final #994 contracts.

## Verification

The database and runtime targets were synthetic, owned by this task and isolated from source databases. No production service or provider was used.

| Check | Observed result |
| --- | --- |
| Fresh local migration reset | All 260 migrations applied |
| Full pgTAP after fresh reset | 64 files, 1,667 assertions passed; verified undo suite includes 111 assertions |
| Database lint | Passed with `--fail-on error --schema public,auth`; unused-variable warnings remain |
| Real SQL/PostgREST and independent-backend races | 44 cases passed, zero skips across five suites, including seven Flex reconciliation cases and six undo races |
| Actual Auth/REST/Edge/RLS/SQL runtime | 53 cases passed, zero skips; nine v2 undo cases include the actual inspector, status-only apply upgrade, stale state, release, replay, forged prior state and authorization |
| Full unit suite | 4,249 passed across 571 files; 125 guarded tests / 15 files skipped. Opt-in runtime execution is evidenced separately above |
| App lint, typecheck and critical tests | Passed |
| Edge lint and typecheck | Passed |
| Desktop and mobile production browser suites | 82 passed, 18 intentional mobile skips; native CDP touch probe passed |
| Final undo desktop/mobile browser rerun | 10 passed, zero skips on the final SQL/client candidate |
| Build, bundle budget and Capacitor sync | Passed |
| Synthetic runtime controller tests | 88 passed; runner expectations include the ninth undo case |
| Governance | Fails on newly disclosed dependency advisories; no audit baseline or dependency suppression was changed |

Negative controls detected the actual faults. The pure status apply test failed two assertions against the preceding SQL implementation, then passed with the fix. The committed-replay/profile-lock race raised `55P03` against the old implementation and passed before releasing the lock with the fix. Earlier pair rollback tests failed 13 cases against the original implementation; conflict, decline, generation, batch draft/busy and focus controls are retained with the review evidence.

The first unrestricted full unit run also exposed an outdated direct-write guard still expecting `unconfirmAssignment`, a missing Git index in the Linux archive, and two UI timing failures. The guard now checks the atomic undo API, the isolated Linux snapshot has its own source index, and the UI cases passed in isolation. The entire suite then passed with four workers; no production component or unrelated test expectation was changed to conceal those failures.

Production-build measurements used identical paged fixtures, 150 technicians, 45 jobs, 90 days and 4x CPU throttling. Sequential runs measured vertical scroll p95 at 50.1 ms on final #994 and 33.4 ms on #995; horizontal p95 was 83.4 ms and 66.7 ms respectively. Floor frames were about 16.7 ms. These are machine-specific observations, not a universal performance guarantee. The benchmark's original unpaged mock caused the prior `RangeError`; only fixture pagination was repaired.

The final owned runtime `staffing-ci-5f67a2f382` completed certified teardown with `ownedResourcesRemoved: true`. Earlier runtime B passed all 52 then-current cases and was also retired. Private evidence is retained outside Git. The plain SQL target is retired after final checks; source databases and the dirty primary checkout are untouched.

## Remaining release conditions

1. Resolve the fresh dependency audit. [Capacitor Android/iOS 8.5.0 has a critical native WebView advisory](https://github.com/advisories/GHSA-rvm3-566m-v7fv), patched in 8.5.1; native applications must be rebuilt and redistributed. [Selector parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) and [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) also have new advisory paths. This affects the shared dependency lock, including #994. No unrelated dependency migration is bundled here.
2. After #994 merges, refresh main and the #995 target and obtain required checks across CI, CodeQL and Security. A manual workflow run does not execute the PR-only dependency-review job.
3. Obtain actual CodeRabbit coverage through the final HEAD and address all actionable findings. The previous 121-file review exceeded the 100-file allowance; green status from a skipped review is insufficient.
4. A human performs the linked production migration dry-run/apply and deliberate second read. Preserve #994's production role inventory and retirement/drainage of old Flex workers. Only historical local data was observed to contain invalid/mismatched roles; this is not a production inventory result.
5. Keep the v1 opt-out during the #995 rollout. #996 must remain unmerged until managers have used #995 enabled for two weeks without regressions.

Code rollback is the existing v2 default flag/opt-out or a reviewed revert. Database rollback is a forward fix that preserves the ledger, claims and durable cancellation relationships; do not drop them while work is pending. No approval, merge or production deployment was performed.

Evidence: `D:/dev/pr994-regression-evidence`, `/tmp/pr995-fix-prime-20261006/evidence` and the certified runtime root `D:/dev/pr995-runtime-fixed-20261011`. Original findings and negative controls remain in `PR995_REVIEW_2026-10-05.md` and its accompanying probes.
