# Phase 2 — Backend trust-boundary hardening

This document records the Phase 2 work from
`docs/ENTERPRISE_CODEBASE_AUDIT_2026-06-23.md`. Phase 0 (containment) and
Phase 1 (secure delivery control plane) are complete; Phase 2 makes the backend
trust boundary explicit, least-privilege, and enforced by CI.

## What Phase 2 delivers

### 1. Edge Function exposure classification (enforced)

Every deployable Edge Function is classified by exposure class in
`scripts/governance/edge-function-exposure.json`:

| Class | Meaning |
| --- | --- |
| `public-token` | Reachable without a user session; protected by a per-resource token, signed link, shared secret, or intentionally public. Must document an `internalGuard`. |
| `authenticated-user` | Requires a valid Supabase user JWT; no extra role. |
| `privileged-role` | Requires a user JWT plus an internal role/capability check. |
| `service-only` | Invoked by pg_cron, triggers, or trusted server code with the service role. When `verifyJwt: false` it must verify the service-role secret or an equivalent guard. |

`npm run governance:exposure` (part of `npm run governance`, a required CI check)
fails when:

- a function directory has no classification,
- `supabase/config.toml` `verify_jwt` drifts from the reviewed manifest, or
- a `verifyJwt: false` function has no documented `internalGuard`.

This makes the gateway exposure of every function a reviewed, version-controlled
control instead of an implicit default. Flipping `verify_jwt` now requires a
manifest update in the same PR.

**Configuration fix found and applied:** `csp-report` was missing from
`config.toml`, so Supabase's default `verify_jwt = true` would have rejected
credential-less browser CSP reports. It is now declared `verify_jwt = false`
with a documented guard.

### 2. Liveness separated from privileged diagnostics (ENT-OBS-02)

- `supabase/functions/health/` — new minimal liveness/readiness probe. Returns
  only `{ status, service, timestamp }`. No database, storage, or service-role
  access. Safe for external uptime monitors and load balancers.
- `supabase/functions/system-health/` — rewritten as a privileged diagnostic.
  It now:
  - requires an authenticated **admin/management** caller (was: no caller check),
  - returns integrity **counts only** (was: sample business rows),
  - never returns raw database error text to the client (logged server-side),
  - writes a `security_audit_log` entry on every access and on denial,
  - returns HTTP 200 with status in the body so a data warning is not mistaken
    for an endpoint outage.

### 3. SECURITY DEFINER / anonymous grant gate (ENT-DB-01)

`npm run governance:sql-grants` replays every committed migration in order and
computes the set of functions still executable by `anon`/`PUBLIC`. New
exposures fail CI unless added to the reviewed
`security-definer-grant-baseline.json`.

Migration `20260624120000_phase2_revoke_anon_rpc_execute.sql`:

- sets `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS
  FROM PUBLIC`, so new functions are not auto-exposed to anonymous PostgREST
  callers, and
- revokes anonymous `EXECUTE` from 11 data-returning/data-mutating RPCs that
  were still reachable after Phase 0 (expense approval/submission/receipt,
  visible-amount timesheet reads, batch timesheet reads, billable-hours,
  category resolution, staffing-matrix, profiles-with-skills, evento rate, and
  the assignment lock helper).

`authenticated` and `service_role` grants are intentionally untouched — this is
a surgical removal of unauthenticated reach, not a behavior change for signed-in
users. The remaining baseline entries are overwhelmingly trigger functions
(arity 0), which fire with the table owner's privileges regardless of the
`anon` grant, plus the three intentionally public RPCs (artist form / tour
guest payload).

### 4. Shared Edge Function hardening primitives

`supabase/functions/_shared/http.ts` gained reusable building blocks for the
priority-function migration:

- `getCorrelationId(req)` / `correlationHeaders(id)` — propagate a
  browser → Edge → database → provider trace id.
- `readBoundedText` / `readBoundedJsonObject` — enforce a request-size limit
  (default 1 MiB) via both `Content-Length` and decoded byte length, throwing
  HTTP 413.
- `redactSensitiveValues(value)` — recursive, separator-insensitive redaction
  of secrets/tokens for safe logging and telemetry, with cycle protection.

These are covered by unit tests in `supabase/functions/_shared/http.test.ts`.

### 5. Database authorization regression tests

`supabase/tests/database/phase2_trust_boundary.sql` (pgTAP, run by the required
`RLS/RPC security tests` job) asserts:

- the 11 revoked RPCs are not executable by `anon`,
- `authenticated`/`service_role` retain access where expected,
- Phase 0 closures (profile privilege trigger, availability/vacation reads,
  `get_job_total_amounts`, `log_activity_as`) remain in place.

## Exit-gate status

| Phase 2 exit gate | Status |
| --- | --- |
| 100% of callable privileged RPCs have explicit grants and authorization tests | Anonymous reach revoked from the data-bearing RPCs surfaced by the gate; gate now blocks regressions; pgTAP covers the closures. Trigger-only functions remain on a documented baseline. |
| 100% of service-role Edge Functions have an enforced exposure classification | Done — every function classified and enforced by `governance:exposure`. |
| No health endpoint returns business samples or internal errors to normal users | Done — liveness/diagnostic split with role check, audit, and redaction. |
| Public endpoints have durable abuse controls | Partially — exposure classification and documented guards in place; `get-google-maps-key` already enforces role + daily quota. Per-endpoint durable rate limiting for the remaining public-token endpoints is tracked as follow-up. |

## Follow-up (not in this change)

- Migrate the priority privileged Edge Functions (staffing, payouts/expenses,
  Flex mutations, WhatsApp/email, document access) onto
  `createHttpHandler` plus the shared correlation/redaction/size-limit
  primitives. The grandfather baseline in `edge-function-baseline.json` still
  lists these. User-admin functions (`create-user`, `delete-user`) were
  migrated on 2026-06-23 as the first follow-up slice. Payout/expense
  notification functions (`send-expense-notification`, `send-job-payout-email`,
  `send-payout-override-notification`) were migrated on 2026-06-23 as the next
  follow-up slice, including explicit service-role/privileged-role guards and
  bounded payload parsing.
- Add durable, storage-backed rate limiting for public-token endpoints.
- Continue ratcheting the `anon`/`PUBLIC` grant baseline downward (trigger
  functions can be revoked from `anon` without behavioral impact).
