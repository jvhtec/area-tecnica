# Full Codebase Audit — 2026-07-01

## Scope and method

- **Branch audited:** `claude/codebase-audit-no7zwn` (off `main` @ `f588687`)
- **Focus:** Full-spectrum audit — CI health, security (edge-function authorization,
  secrets, XSS, CORS), dependencies, database/RLS, and code-quality metrics.
- **Relationship to prior audits:** This is a fresh point-in-time snapshot. It
  confirms which findings from `docs/CODE_QUALITY_AUDIT_2026-06-27.md` and
  `docs/ENTERPRISE_CODEBASE_AUDIT_2026-06-23.md` still hold, and adds one
  authorization observation not previously called out explicitly.

### What was actually run (results, not estimates)

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.app.json`) | **PASS** — 0 errors |
| Lint | `npm run lint` (app + edge functions) | **PASS** — exit 0 |
| Unit/component tests | `npm run test:run` | **PASS** — 1167 tests, 214 files |
| Governance | `npm run governance` (all sub-gates) | **PASS** — exit 0 |
| Production build | `npm run build` | **PASS** — built in ~38s |
| Bundle budget | `npm run budget:bundle` | **PASS** — within budget |
| Dependency audit | `npm audit` | 11 vulns (6 high / 5 moderate), all in dev/build tooling |

### Codebase size

- 1,327 TS/TSX source files under `src/` (~282K LOC excluding generated types)
- 67 deployable Supabase edge functions + shared utilities
- 170 SQL migrations (initial production schema + timestamped increments)
- 214 test files / 1,167 tests; 141 hooks; 49 route pages

## Executive verdict

**The build is green across every CI gate.** Typecheck, lint (0 errors), the full
1,167-test suite, all governance gates, the production build, and the bundle budget
all pass on a clean `npm ci` install. There are **no hardcoded secrets in source or
git history**, no `eval`/`new Function`, and the two `dangerouslySetInnerHTML` sites
are both DOMPurify-sanitized.

The material findings are: (1) a **defense-in-depth authorization gap** where several
edge functions classified `privileged-role` in the governance manifest authenticate
the caller (`verify_jwt=true`) but do **not** verify the caller's role in code;
(2) known **dev-only dependency vulnerabilities** already documented as accepted risk;
and (3) the ongoing **code-quality breadth** issues (pervasive `any`, oversized files)
carried over from the June audits. None block release.

| Dimension | Grade | One-line summary |
| --- | --- | --- |
| CI / build health | A | Every gate green on clean install |
| Secrets / injection | A | No secrets, no eval, sanitized HTML sinks |
| Edge-fn authorization | B− | Auth enforced everywhere; role enforcement missing on ~8 privileged Flex/util fns |
| Dependency health | B− | No prod-runtime criticals; dev-tooling highs accepted in SECURITY.md |
| Database / RLS | A− | RLS enabled on all app tables; SECURITY DEFINER fns set search_path |
| Type safety | C | Compiles clean, but ~939 `: any` annotations + broad `any` warnings |
| Module size | C+ | ~14 files >1,200 lines; a few 1,800–2,100-line god files |

## Remediation status in this PR

Follow-up commits on this PR address the actionable authorization findings from this
audit:

- `apply-flex-status`, `archive-to-flex`, `backfill-flex-doc-tecnica`,
  `create-flex-folders`, `manage-flex-crew-assignments`, `sync-flex-crew-for-job`,
  and the admin CSV import function now call `requireAdminOrManagement()` before any
  service-role mutation or Flex side effect.
- `evaluate-achievements`, `recalc-timesheet-amount`, and `background-job-deletion`
  now require a service-role bearer/apikey via `requireServiceRoleRequest()`.
- `staffing-sweeper` now uses the shared service-role guard.
- `governance:exposure` now scans source files so `privileged-role` functions must
  reference a recognizable role guard, `service-only` functions must document and
  implement a recognizable service/shared-token guard, and `public-token` functions
  must document their runtime guard.
- Exposure classes were corrected where the prior labels did not match behavior:
  password reset remains intentionally callable for account recovery, `security-audit`
  remains an app audit logging endpoint, `get-secret` is classified as authenticated
  but still always returns HTTP 410, and mixed service/user staffing reminder paths are
  documented as privileged-role.

The accepted dependency risks and broad code-quality items remain follow-up tracks; no
forced dependency migration was performed in this PR.

## Findings

### 1. Edge-function role enforcement relies on gateway auth alone (defense-in-depth)

**Severity: Medium** — authenticated-but-unprivileged access to privileged operations.

`scripts/governance/edge-function-exposure.json` classifies functions into
`public-token` / `authenticated-user` / `privileged-role` / `service-only`. The
governance gate (`check-edge-function-exposure.mjs`) only verifies that the
`verify_jwt` value matches `supabase/config.toml` — it does **not** verify that a
function classified `privileged-role` actually checks the caller's role in code.

Several functions labelled `privileged-role` set `verify_jwt=true` (so any
authenticated user — including a basic `technician` — passes the gateway) but perform
**no in-code role check**:

- `apply-flex-status` — resolves the user only optionally; no role gate
- `archive-to-flex`
- `backfill-flex-doc-tecnica`
- `create-flex-folders`
- `manage-flex-crew-assignments` — `resolveActorId()` is for audit only, not a gate
- `sync-flex-crew-for-job`

These mutate Flex ERP state / folder structure. Because they run with the service-role
key, RLS does **not** constrain what they touch — so the only thing standing between a
logged-in non-admin and these operations is the absence of a UI button. Contrast with
peers that do it correctly: `create-user`, `delete-user`, `secure-flex-api`,
`persist-flex-elements`, `system-health`, and most `send-*` functions call
`requireAdminOrManagement(...)` or query `profiles.role` before acting.

**Recommendation:** Add `requireAdminOrManagement()` (already in
`supabase/functions/_shared/auth.ts`) to the six Flex functions above, and extend the
governance gate to assert that every `privileged-role` function references a role-check
helper — turning the manifest classification into an enforced control rather than a
label. This mirrors the ENT-SEC remediation pattern already applied elsewhere.

### 2. Service-only functions — verify the internal guard is real

**Severity: Low (verify)** — `evaluate-achievements`, `recalc-timesheet-amount`, and
`background-job-deletion` are classified `service-only` with `verify_jwt=true` but show
no `timingSafeEqual`/shared-secret check in code (they rely on the gateway JWT).
`staffing-sweeper` and `send-expense-notification` and `cleanup-corporate-email-images`
*do* implement an explicit service-role/token comparison. Confirm the three above are
only ever invoked by trusted callers (pg_cron / other edge functions with the
service-role JWT) and cannot be reached by an ordinary authenticated user; if they can,
add an explicit service-secret check like the sweeper's.

Note the good examples this audit confirmed as correct: `get-secret` is fully neutered
(always returns HTTP 410 after auditing the attempt), `staffing-click` validates an
HMAC over `rid:phase:exp`, and the public artist-form functions
(`upload/delete-public-artist-rider`) validate a per-form token plus rate limits.

### 3. Dependency vulnerabilities — all in dev/build tooling (accepted)

**Severity: Low** — `npm audit` reports 11 vulnerabilities (6 high, 5 moderate). Every
one is in build/dev-only dependency trees, not the shipped runtime:

- **`@capacitor/assets` → `@trapezedev/project` → `replace` → `minimatch` (ReDoS)** and
  **`tar` (path traversal)** — native asset-generation tooling, no fix available.
- **`react-quill` → `quill` XSS** — already documented in `SECURITY.md` as accepted:
  the app uses `quill@2.0.3` directly (not the vulnerable bundled copy).
- **`exceljs`/`xcode` → `uuid` buffer bounds** — moderate; fix requires an exceljs major
  downgrade (breaking).

These match `SECURITY.md`'s accepted-risk register. **Action:** re-confirm the quill
and uuid items on the next dependency review; consider migrating off the unmaintained
`react-quill` (TipTap/Lexical) as previously noted. Do **not** run `npm audit fix
--force` — it would downgrade `exceljs` and `quill` and break the app.

### 4. CORS is wildcard `*` without credentials

**Severity: Informational.** `_shared/cors.ts` sends `Access-Control-Allow-Origin: *`
across 37 functions and does **not** set `Access-Control-Allow-Credentials`. Because
auth travels as a Bearer token (not cookies), wildcard CORS does not enable a CSRF/
credential-theft path here, so this is acceptable. Flagged only for awareness.

### 5. Code-quality breadth (carried over from June audits — still true)

- **`any` usage:** ~939 explicit `: any` annotations across `src/` still erode
  type-safety value. Same trend as the 2026-06-27 audit.
- **Oversized modules:** ~14 files exceed 1,200 lines, topped by
  `src/features/tour-ops/TourOpsManagementHub.tsx` (2,116),
  `tourSchedulingService.ts` (1,885), and
  `useConsumosTool.ts` (1,820). The file-size-budget gate is a ratchet, so these are
  frozen-in-place rather than growing, but they remain refactor candidates.
- **`console.*` in source:** ~1,133 in `src/` and ~253 in edge functions. The app ones
  are stripped in production (`esbuild drop: ['console','debugger']` in
  `vite.config.ts`), so this is a dev-noise issue, not a prod leak. Edge-function logs
  persist server-side — audit those for accidental PII logging.
- **`.single()` (185 sites):** each throws on 0 rows; confirm callers that can
  legitimately return no rows use `.maybeSingle()` to avoid noisy errors.
- **No TODO/FIXME/HACK markers** and only 4 `@ts-ignore`/`@ts-expect-error` — debt is
  not hidden in comments.

### 6. Database / RLS — healthy

- 174 tables created across migrations; **165 have `ENABLE ROW LEVEL SECURITY`**. The
  9 that don't are: three tables in the internal `dreamlit` schema (auth-email
  plumbing, not `public`), the `secrets.waha_hosts` table (non-`public` schema), and
  five year-suffixed rate/equipment tables (`rate_cards_2025`, `rate_cards_tour_2025`,
  `rate_extras_2025`, `tour_week_multipliers_2025`, `equipment_models_deprecated_*`)
  which **do** get RLS enabled and policies attached in later migrations (the create
  and enable statements live in different files, so the naive diff under-counts).
  **No `public` application table ships without RLS.**
- **SECURITY DEFINER:** 88 migration files define such functions; the production
  schema alone sets `search_path` on functions 121 times vs 68 definer declarations —
  i.e. definer functions pin `search_path`, closing the classic privilege-escalation
  hole. The `governance:sql-grants` gate enforces this.
- Migration ordering gate passes: 170 migrations with unique, ordered timestamps.

## Recommended next actions (priority order)

1. **Done in this PR:** Add `requireAdminOrManagement()` to the six
   `privileged-role` Flex functions (Finding 1) and extend
   `check-edge-function-exposure.mjs` to assert role-check presence for that class.
2. **Done in this PR:** Harden the three `service-only` functions from Finding 2 with
   explicit service-role checks.
3. **Schedule the `react-quill`/`quill` migration** and re-confirm the accepted
   dependency risks at the next review (Finding 3).
4. Continue chipping at `any` and the largest god-files opportunistically; the
   ratchets already prevent regression.

## Appendix — commands run

```
npm ci --legacy-peer-deps           # (postinstall sharp download is 403-blocked by
                                    #  the sandbox proxy; --ignore-scripts installs clean)
npm run typecheck                   # PASS
npm run lint                        # PASS
npm run test:run                    # 1167 passed
npm run governance                  # PASS
npm run build                       # PASS
npm run budget:bundle               # PASS
npm audit                           # 11 dev/build-tree vulns
```

> Note: `npm ci --legacy-peer-deps` fails during the `@capacitor/assets`→`sharp@0.32.6`
> postinstall because the sandbox proxy returns 403 for the libvips binary download from
> GitHub releases. This is an **environment/network artifact, not a repo defect** —
> `--ignore-scripts` installs cleanly and all gates pass. CI (with normal network) is
> unaffected.
