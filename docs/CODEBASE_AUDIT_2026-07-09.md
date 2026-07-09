# Full Codebase Audit — 2026-07-09

## Scope and method

- **Branch audited:** `claude/codebase-audit-cu3azl` (off `main` @ `d862a8b`)
- **Focus:** Full-spectrum re-audit — CI health, security (edge-function authorization,
  secrets, XSS, storage/RLS), dependencies, and code-quality metrics — with special
  attention to the **58 commits of new surface** landed since the 2026-07-01 audit:
  the Rack Builder tool, the Rider Library (+ Wikimedia metadata enrichment), festival
  and programa push-notification feeds, festival offline mode, Flex material/quote
  reports, Memoria Técnica job/stage binding, and the ReactQuill removal.
- **Relationship to prior audits:** Fresh point-in-time snapshot. Confirms which
  findings from `docs/CODEBASE_AUDIT_2026-07-01.md` and
  `docs/CODEBASE_AUDIT_2026-07-02_DEADCODE_AND_BUGS.md` still hold, verifies the
  2026-07-01 remediations stuck, and adds two new findings on the new surface.

### What was actually run (results, not estimates)

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.app.json`) | **PASS** — 0 errors |
| Lint | `npm run lint` (app + edge functions) | **PASS** — exit 0 |
| Unit/component tests | `npm run test:run` | **PASS** — 1,285 tests, 231 files |
| Governance | `npm run governance` (all sub-gates) | **PASS** — exit 0 |
| Production build | `npm run build` | **PASS** — built in ~37s |
| Bundle budget | `npm run budget:bundle` | **PASS** — within budget |
| Dependency audit | `npm audit` | 10 vulns (6 high / 3 moderate / 1 low), all in dev/build tooling |

### Codebase size (Δ vs 2026-07-01)

- 1,460 TS/TSX source files under `src/` (~307K LOC excluding generated types) — up from 1,327 / ~282K
- 69 deployable Supabase edge functions (+2: `enrich-artist-metadata`, `fetch-flex-material-report`)
- 185 SQL migrations (+15)
- 231 test files / 1,285 tests (+17 files / +118 tests); 10 pgTAP DB suites totalling 2,625 lines (+988 lines for rack builder + rider library authorization)
- 137 hooks; 49 route pages

## Executive verdict

**The build is green across every CI gate on a clean install**, same as 2026-07-01.
The 2026-07-01 remediations held: the six Flex functions still enforce
`requireAdminOrManagement()`, the service-only trio still require a service-role
bearer, and the hardened `governance:exposure` gate now forces every new
`privileged-role` function to carry a real in-code role guard — which the **two new
edge functions demonstrably do**. The `react-quill` wrapper was removed (a
recommendation from the last audit), downgrading the quill advisory from moderate
XSS to low.

The new surface is in materially good shape: all **14 new tables get RLS in the same
migration set**, every new `SECURITY DEFINER` function pins `search_path`, rider file
access was tightened mid-stream and is now covered by ~1,000 lines of new pgTAP
authorization tests, and the one new `dangerouslySetInnerHTML` sink (rack-builder
panel SVG) escapes every interpolated value.

The material findings are: (1) the `push` function's **`broadcast` and
`check_scheduled` actions are callable by any authenticated user** with no role or
service check — the same defense-in-depth class as last audit's Finding 1, now with
a larger blast radius because the new festival/programa feeds hang off
`check_scheduled`; (2) the new **offline cache is never purged at logout**; and (3)
the carried-over dependency and code-quality breadth items. None block release.

| Dimension | Grade | One-line summary |
| --- | --- | --- |
| CI / build health | A | Every gate green on clean install |
| Secrets / injection | A | No secrets; new SVG/editor HTML sinks reviewed and escaped/sanitized |
| Edge-fn authorization | B | July-1 fixes held; new fns guarded; `push` broadcast/check_scheduled still user-callable |
| Dependency health | B | react-quill removed (✔ prior rec); remaining 10 vulns all dev-tooling, accepted |
| Database / RLS | A− | All 14 new tables RLS'd in-migration; definer fns pin search_path; +988 lines pgTAP |
| Type safety | C+ | `: any` flat at 939 despite +25K LOC — ratchet holding |
| Module size | C+ | 15 files >1,200 lines; top-3 god files unchanged (frozen by ratchet) |

## New-surface review (what was checked)

- **Rack Builder** (`src/features/rack-builder/`, 6 migrations): 10 new tables, all
  with RLS in `20260707110200_rack_builder_rls.sql`; layout-item validation hardened
  in a follow-up definer function that pins `search_path`; storage writes gated to
  sound department + admin/management. Panel-SVG print rendering
  (`RackPrintView.tsx`) injects only app-generated SVG whose labels/URLs pass
  `escapeXml()` (`lib/panelThumbnail.ts`). 390 lines of pgTAP permission tests.
- **Rider Library** (`20260706130000` + `20260708120000`): file metadata and
  storage-object policies enforce the festival role contract (admin/management/
  logistics/house_tech manage; assigned technicians read-only on their jobs); the
  initial policies were corrected in `20260708120000_fix_rider_file_access_policies.sql`
  and locked in by 598 lines of pgTAP.
- **`enrich-artist-metadata`**: `requireAuthenticatedRole` (admin/management/
  logistics) before any Wikidata/Wikipedia call; outbound fetches are hardcoded to
  `wikidata.org`/`wikipedia.org` hosts (no SSRF surface); manifest + config.toml
  entries match.
- **`fetch-flex-material-report`**: `requireAuthenticatedRole`
  (admin/management/house_tech) before resolving Flex elements; manifest entry
  matches.
- **Festival/programa push feeds** (`push/festivalFeed*.ts`, `programaFeed*.ts` + 2
  migrations): delivery-log tables dedupe sends; both tables RLS'd. See Finding 1
  for the caller-authorization gap on the dispatch path.
- **Festival offline mode** (`src/lib/offline/`): IndexedDB stores snapshots, a
  pending-change queue, and file blobs; no auth tokens or signed URLs are persisted.
  See Finding 2 for logout behavior.
- **RichTextEditor** (ReactQuill replacement, `src/components/emails/`): uses
  `template.innerHTML` only to restructure the editor's own Quill output (template
  parsing does not execute scripts); the email preview sink remains
  DOMPurify-sanitized (`PayoutEmailPreview.tsx`).
- **Secrets/XSS sweep of the full diff:** no hardcoded credentials, no `eval`/
  `new Function`; `dangerouslySetInnerHTML` sites in `src/` total 4, all either
  DOMPurify-sanitized, static (chart theming), or XML-escaped (rack builder).

## Findings

### 1. `push` function: `broadcast` and `check_scheduled` accept any authenticated user

**Severity: Medium** — authenticated-but-unprivileged access to privileged operations
(same class as 2026-07-01 Finding 1, which fixed the Flex functions but not `push`).

`supabase/functions/push/index.ts` routes `broadcast` and `check_scheduled` through
`resolveCaller(client, token, allowService=true)` — but `resolveCaller` tries the
caller's **user token first** and returns success for *any* valid user. Neither
`handleBroadcast` nor `handleCheckScheduled` then checks a role. Consequences for a
logged-in basic `technician`:

- **`broadcast`**: send spoofed push notifications (arbitrary `type`, `job_id`,
  `job_title`) to management, admins, sound-department users, and job participants —
  e.g. fake assignment or document notifications.
- **`check_scheduled`**: trigger the daily morning summary with `force: true`
  (bypasses the schedule/already-sent check → repeatable spam), and fire the new
  festival/programa feed ticks at will (the delivery logs dedupe real sends, so
  impact there is limited to premature delivery).

The manifest classifies `push` as `authenticated-user`, so the hardened
`governance:exposure` gate is *satisfied* — the classification is accurate for
subscribe/unsubscribe/test, but it launders the two privileged actions inside the
same endpoint.

**Recommendation:** in `resolveCaller`, when `allowService` is true, accept **only**
the service-role key / `PUSH_INTERNAL_TOKEN` for `broadcast` and `check_scheduled`
(or add a `requireAdminOrManagement` fallback for user-token broadcast). Then
reclassify those paths in the manifest's `internalGuard` note. This closes the last
known gap of the July-1 authorization sweep.

### 2. Offline cache is never purged at logout

**Severity: Low** — data-at-rest exposure on shared devices.

`src/lib/offline/offline-db.ts` persists festival snapshots, the pending-change
queue, and downloaded file blobs (which can include artist riders and technical
docs) in IndexedDB. The only wipe helper is `__resetOfflineDbForTests`; nothing in
`useOptimizedAuth`/`token-manager` clears the three stores on sign-out, so a
subsequent user of the same browser profile can read the previous user's cached
festival data from devtools. Auth tokens are *not* stored there, and Supabase
session storage is cleared normally — this is contained to cached content.

**Recommendation:** export a `clearOfflineData()` that deletes (or clears the stores
of) the offline DB and call it from the sign-out path. Consider scoping cached rows
by user id as a second layer.

### 3. Dependency vulnerabilities — improved; remainder accepted (dev/build tooling)

**Severity: Low.** `npm audit`: 10 vulnerabilities (6 high, 3 moderate, 1 low) vs 11
last audit. The **react-quill advisory is gone** — the wrapper was removed in #795
per the prior recommendation; the direct `quill@2.0.3` dependency now carries only a
low advisory. The rest are unchanged and match `SECURITY.md`'s accepted-risk
register: `@capacitor/assets` → `@trapezedev/project` → `replace`/`minimatch`/`tar`
(native asset tooling, no fix), and `exceljs`/`xcode` → `uuid` (fix requires a
breaking downgrade). The `audit:deps` governance baseline passes. Still do **not**
run `npm audit fix --force`.

### 4. Rack Builder storage buckets are public-read (documented, accepted)

**Severity: Informational.** `20260707110300_rack_builder_storage.sql` creates
`rack-builder-device-images` and `rack-builder-connector-images` with
`public=true`; the migration documents the rationale (non-sensitive device photos /
connector SVGs; synchronous `getPublicUrl` needed across palette/canvas/PDF paths).
Writes are RLS-gated to sound department + admin/management. Acceptable as designed —
flagged so nobody later stores anything sensitive in these buckets. Note that a
public bucket means the *select* policy does not gate anonymous URL access.

### 5. Code-quality breadth (carried over — stable, not growing)

- **`any` usage:** 939 explicit `: any` annotations — **flat** vs 2026-07-01 despite
  ~25K new LOC; the burn-down/ratchet is holding.
- **Oversized modules:** 15 files >1,200 lines (was ~14). Top three unchanged and
  un-grown: `TourOpsManagementHub.tsx` (2,116), `tourSchedulingService.ts` (1,885),
  `useConsumosTool.ts` (1,819). The file-size budget kept `ModernHojaDeRuta`/
  `JobCardNewView` from regressing during this period (commit `0259e0d`).
- **`console.*`:** ~1,129 `console.log` in `src/` (stable; stripped from production
  builds by esbuild) and ~695 `console.*` in edge functions — the latter persist
  server-side; keep auditing for accidental PII.
- **`.single()` (202 sites, +17):** unchanged guidance — confirm callers that can
  return 0 rows use `.maybeSingle()`.
- **No TODO/FIXME/HACK markers** and only 4 `@ts-ignore`/`@ts-expect-error`.
  (Case-insensitive greps false-positive on Spanish "todo" — 0 real markers.)

### 6. Database / RLS — healthy, including all new surface

- 15 new migrations since the last audit create **14 tables, every one with
  `ENABLE ROW LEVEL SECURITY` and policies in the same migration set** (festival/
  programa push feed ×3, `artist_external_metadata`, rack builder ×10).
- Every new `SECURITY DEFINER` function sets `search_path` (verified per-file across
  all 2026-07 migrations).
- `push_cron_config` (pre-existing) stores a nullable `service_role_key` column in
  `public` — RLS is enabled with admin-only policies, so this is contained, but
  storing a service key in an app table is worth revisiting.
- Migration ordering gate passes: 185 migrations, unique ordered timestamps.
- pgTAP authorization coverage grew by 988 lines (rack builder permissions, rider
  library import/storage), and the rider-file policy fix (`20260708120000`) is
  regression-locked by those tests.

## Recommended next actions (priority order)

1. **Close Finding 1:** require a service token (or admin/management role) for the
   `push` function's `broadcast` and `check_scheduled` actions.
2. **Close Finding 2:** wipe the offline IndexedDB stores on sign-out.
3. Re-confirm the accepted dependency risks at the next review; the react-quill item
   can be marked resolved in `SECURITY.md`.
4. Continue the `any` burn-down and god-file refactors opportunistically; the
   ratchets are demonstrably holding both flat.

## Appendix — commands run

```
npm ci --legacy-peer-deps --ignore-scripts   # sharp postinstall 403-blocked by sandbox
                                             # proxy (same environment artifact as 07-01)
npm run typecheck                   # PASS
npm run lint                        # PASS
npm run test:run                    # 1285 passed / 231 files
npm run governance                  # PASS
npm run build                       # PASS (~37s)
npm run budget:bundle               # PASS
npm audit                           # 10 dev/build-tree vulns (6 high / 3 mod / 1 low)
```

Targeted review: diff of all 58 commits `0493308..d862a8b`; exposure-manifest and
`config.toml` diff; role-guard verification in both new edge functions; RLS/definer/
`search_path` greps across all 2026-07 migrations; storage-policy review (rack
builder buckets, rider files); XSS-sink and secrets sweep of the full diff; offline
store persistence and logout-path check.
