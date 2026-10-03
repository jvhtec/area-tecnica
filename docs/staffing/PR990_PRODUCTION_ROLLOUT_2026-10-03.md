# PR990 production rollout — 2026-10-03 (Europe/Madrid)

The maintainer explicitly delegated this release's production migration, merge and deployment to the agent. PR990 was squash-merged at `3552531c2b5c408c7aeda5c2c238483fe635fda3` at 2026-10-02 22:05:42 UTC (October 3 in Madrid), from the reviewed head `488cd85531b75876c2ee86387fc7b0d1a06c208e`. No protection bypass or agent approval was used. Future releases retain the ordinary human-merge boundary.

## Observed release order

1. Verified clean checkout, current main, all required PR checks green and CodeRabbit complete.
2. Read both migration bodies and the final handler diff; captured previous production handler bundle, function metadata and removal RPC definition privately for rollback.
3. Ran `supabase db push --linked --skip-vault --dry-run`: exactly `20261002082653` and `20261002105500`, no seeds, roles or vault updates.
4. Applied those two migrations before merge. Second dry-run reported up to date. Production now has 251 migrations; both versions exist, the assignment RPC is invoker-security, service execution is allowed, anonymous/authenticated execution is denied, and removal contains the shared staffing lock.
5. Merged the exact reviewed head. Supabase integration action `b52559fbf09740429edbf7e0a20bf797` reported migrations up to date at 22:06:27 UTC, then deployed configured functions through 22:07:05 UTC. No parallel manual function dispatch was run.
6. Verified successful Supabase and Cloudflare checks for the merge commit. Cloudflare deployment `272f8e19-da2c-475f-934e-5594ffde6300` serves [the deployed revision](https://272f8e19.area-tecnica.pages.dev). All merge-commit CI, CodeQL and Security workflows also passed.

## Deployed staffing source

Every returned bundled source file matches the reviewed checkout after normalizing line endings and final newlines.

| Function | Production version | JWT gateway setting | Source files compared |
| --- | --- | --- | --- |
| staffing-click | 763 | false | 9 |
| send-staffing-email | 716 | false | 13 |
| staffing-orchestrator | 376 | false | 6 |
| staffing-sweeper | 366 | false | 5 |

The new click bundle calls `assign_staffing_offer`. Sender, orchestrator and sweeper source parity was checked because the integration deploys configured functions beyond the one changed by PR990. The JWT settings match the repository; each public-gateway handler retains its own credential checks.

## Production verification

- Real service-role RPC probe rejects a nonexistent request with the expected missing-row guard.
- A bounded, rollback-only SQL transaction exercised new membership, two exact accepted dates, replay after extending the live job, a separate accepted added-date request retaining membership scope, and removal of all three schedules and membership. Assertions passed, the transaction rolled back, and no fixture job remained. No staffing email/WhatsApp was sent by this probe.
- Actual HTTP: health 200; click HEAD 204; unauthenticated sender, orchestrator tick and sweeper each 401. A parameterless click GET was rejected by Cloudflare with 403 / 1010; this is gateway rejection evidence, not handler method characterization.
- The production login page rendered after deployment, with no captured browser errors. Authenticated management/technician UI workflows were not exercised in production. External delivery was also not tested. The isolated local environment already passed 50 real Edge Runtime/Auth/gateway/database checks with provider delivery captured.
- Function logs from 22:05:42–22:15:00 UTC contained zero matching worker-boot-error or uncaught-exception records. This is a bounded log-string check, not a guarantee about all application errors.
- Recovery baseline: zero failed confirmed-offer requests in the previous seven days and zero failures since merge. One legacy unscoped confirmed offer missing membership predates release (September 26). Its private identifier is retained in local evidence; it needs manager inspection, not blind replay or broadened date consent.

## Recovery and next increment

The [read-only recovery queries](../../scripts/sql/staffing-acceptance-recovery.sql) remain the operational triage path. An answered link does not retry assignment. Roll back only the handler to the captured previous reviewed source if needed, retaining the backward-compatible RPCs and migrations; no destructive database rollback was performed.

The next branch starts from this merged main and closes campaign characterization gaps against the isolated historical local stack. Campaign counting, cancellation, lock ownership and request vocabulary stay unchanged until their actual behavior is executable evidence. Direct matrix persistence and cancellation remain separate Phase 1 gaps.
