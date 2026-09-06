# Codebase Re-Audit — opened 2026-09-04

**Opened:** 2026-09-04 on `main` at `3ff4d13`
**Last re-verified:** 2026-09-06 on `main` at `7e4040b` — a **fresh whole-codebase pass**, not a delta review
**Prior passes:** 2026-09-05 on `f87b836` (after PR #920 and the #921–#929 series); 2026-09-04 on `3ff4d13`
**Previous audit:** [`docs/plans/2026-07-codebase-audit-roadmap.md`](plans/2026-07-codebase-audit-roadmap.md) (2026-07-09)
**Scope:** React/Vite app, Supabase migrations/RLS/RPC/grants, **Storage buckets and `storage.objects` policies**, all Edge Functions, governance gates, tests/CI, PWA delivery, dependencies, bundle output.
**Method:** every gate re-run locally at each verification; static data-flow tracing; **all SQL findings verified against the live production database** (`syldobdcdsgfgjtbuwxm`) via read-only catalog queries and role-impersonated (`SET LOCAL ROLE anon` / `authenticated`) row counts. The 2026-09-06 pass adds **unauthenticated HTTP probes against the live Storage and PostgREST APIs using only the public `anon` key**, so reachability is demonstrated end to end rather than inferred from policy text. Numbers below are measured at the stated date, not carried forward.

This is a living register. Each finding carries its own status; the scorecard shows every
verification pass so the deltas are visible rather than overwritten.

**What the 2026-09-06 pass changed.** The two previous passes worked the same ground — table RLS,
RPC bodies, Edge Functions, source ratchets — and that ground is now in good shape: every gate is
green, 2,101 tests pass, and exactly one table (`activity_catalog`, 54 deliberate rows) is readable
with the anon key. So this pass went where the earlier ones never looked, on **both** axes.

*Security:* Supabase Storage, and the privilege catalog rather than the policy catalog. Both held
findings more severe than anything the register previously carried, and both were invisible to
every gate the repository runs — SEC-17, SEC-18.

*Quality, reliability and maintainability:* duplication analysis, file-length distribution, the
dead-code sweep's blind spot, production observability, dependency currency, internationalisation
and — for the first time in any pass — accessibility. Findings QLT-09 through QLT-12, REL-03,
A11Y-01 and DEP-01.

The two halves converge on one observation, which is the most useful thing this pass produces. The
codebase's controls are strong and its discipline is real; what neither covers is **anything that
exists in more than one place**. `storage.objects` is a second policy surface beside `public`.
Production privileges are a second privilege surface beside the migration chain. And in the
application, the same feature is written once per department across five layers — which is exactly
why three separate findings in this register have the shape "the correct fix was applied to one
member of a set". Individually each file is under budget, linted and typed. Collectively they drift.

---

## Executive assessment

**As of 2026-09-06 everything this register set out to check is closed, and the fresh pass found
that the register was checking the wrong surface.** Nine PRs (#920–#929) shut every P0 against the
live database, put the two structural quality findings behind new gates, and took schema drift from
"counts disagree" to a normalized catalog exporter with an applied reconciliation migration. All of
that holds, and it was verified again on `7e4040b`.

But the ground those passes worked — table RLS, RPC bodies, Edge Functions, source ratchets — is
not the whole attack surface. Going somewhere new produced two findings more severe than anything
the register previously held, and **both are reachable with no credentials at all**: 1,273 files in
buckets explicitly marked `public = false` are listable and downloadable with the public anon key
(SEC-17), and five `SECURITY DEFINER` functions with no authorization check are callable by `anon`,
two of which write to `timesheets` and `tours` (SEC-18). Both were demonstrated end to end against
production, not inferred from policy text.

The pattern is worth naming plainly, because it is the same one the September pass identified and
is now visible one level up. September's version was "good primitives, partial adoption". This
pass's version is **good controls, applied to the surface someone thought to point them at**. The
gates are genuinely strong: twelve sub-gates, ratcheted baselines, a schema catalog exporter. Every
one of them reads `src/`, `supabase/migrations/` or `supabase/functions/`. `storage.objects` is
described in none of those, and function *privileges* on production diverge from the migration
chain by 81 entries — so the gate that exists precisely to prevent unguarded anon RPC access
reports green about a schema that is not the one running.

The corollary for prioritisation: SEC-16, the register's previous top item, now ranks fourth. It
is the larger dataset, but it requires a valid login; SEC-17 and SEC-18 require nothing.

What the 2026-09-04 pass found, and where each landed:

- **`profiles` readable in full by every authenticated account** — 313 rows, 313 ICS bearer tokens,
  286 national IDs. Both halves are now fixed. Tokens live in an owner-scoped vault with client
  write privileges revoked; `profiles_select` is correlated to owner / operational admin /
  shared-job technician. Measured on production: a claimless authenticated session now reads **0**
  profile rows, and a real technician reads exactly their shared-job set.
- **Three tables readable with the public anon key** — an anon sweep of every table `anon` can
  `SELECT` now returns rows from **one**: `activity_catalog` (54 rows of static reference data,
  deliberately public). `festival_artists` (598) and `rate_extras_2025` are closed, along with the
  `ja.job_id = ja.job_id` self-comparison that SEC-03 had fixed on one table without sweeping.
- **Good primitives, partial adoption** — the pattern that dominated the September baseline is
  now enforced rather than encouraged. `escapeHtml` covers every email function; a new
  `check-edge-logging` gate freezes console sites so the `structuredLogger` migration can only move
  forward; the lint gate enforces its own global and per-domain budgets; the file-size budget
  covers `supabase/functions/` as a second domain.

**The single most useful thing this pass adds is a residual, not a new defect.** Narrowing
`profiles_select` reduced exposure sharply but did not eliminate it: a technician still reads the
**full** profile row — `dni`, `residencia`, `phone`, `email` — for every colleague they have ever
shared a job with. Measured on production: 175 accounts have such reach, averaging 55 colleagues
and peaking at **134 of 313 profiles (43%)**. `get_profile_directory()` exists and returns exactly
the safe projection, but it is an *alternative* the caller may choose, not a *constraint* the
policy imposes. Closing this means moving colleague-facing reads onto the directory and dropping
the shared-job branch from `profiles_select` — see SEC-16.

The second residual is that **schema-drift detection is instrumented but not gated**: CI exports a
catalog artifact and then compares it against itself, which proves the exporter and comparator run
but cannot detect drift. The production comparison is a documented manual release step.

---

## Scorecard

| Signal | 2026-07-09 | 2026-09-04 | 2026-09-05 | 2026-09-06 | Verdict |
| --- | --- | --- | --- | --- | --- |
| `npm run lint` warnings | 1,904 | 1,216 | 1,145 | **1,145**, gate green | held at par; per-domain budget enforced |
| — of which `no-explicit-any` | ~1,343 | 1,037 | 966 | **966** | ratcheted; functions remain the untreated half |
| `npm run typecheck` | passes, `strict: false` | passes, `strict: true` | passes | **passes** | resolved |
| `npm run typecheck:functions` | did not exist | passes | passes | not re-run (CI covers) | resolved |
| Vitest full suite | "passed" (selective) | 360 files / 1,995 tests | 373 / 2,075 | **380 files / 2,101 tests, all pass** | healthy |
| Coverage thresholds | none | 5 files, never run in CI | 10 files, run in CI | unchanged | resolved |
| Production build | passes | passes | passes | not re-run this pass | ok |
| Bundle (js gzip) | 3.01 MB | 3.10 MB | 3.10 MB / 3.32 MB | not re-measured; #931 raised headroom | PERF-01 target 15% |
| Governance | passes (grandfathered) | passes, 11 sub-gates | passes, 12 sub-gates | **passes, all sub-gates** | green — see SEC-17/SEC-18 for what it cannot see |
| Dependency audit | baseline-aware | 0 advisories | 0 advisories | **0 advisories** | resolved |
| Migrations | 180+ | 203 | 206, all applied | **206, all applied** | ok |
| Live DB vs migration chain | not checked | count mismatch, undiagnosed | 199 object differences, zero policy differences; reconciled | **81 `anon` EXECUTE grants still disagree** (37 live-only, 44 replay-only) | **DB-06 not resolved — see SEC-18** |
| Anon-readable tables (measured) | not checked | 3 (598 + 54 + 4 rows) | 1 | **1** (`activity_catalog`, 54, deliberate) | resolved |
| Profiles visible to a claimless authenticated session | not checked | 313 | 0 | **0** | resolved |
| Unreferenced app modules | not checked | 88 files / ~13,955 LOC | 0 | not re-swept | resolved |
| Objects in *private* Storage buckets readable with the anon key | not checked | not checked | not checked | **1,273 across 7 buckets**, download proven (HTTP 206) | **SEC-17 — critical** |
| Storage buckets accepting an unauthenticated upload | not checked | not checked | not checked | **1** (`lights-memoria-tecnica`) | **SEC-17** |
| `SECURITY DEFINER` functions `anon` may call (non-trigger, live) | not checked | not checked | not checked | **47**, of which **≥5 carry no authorization at all** | **SEC-18 — high** |
| Secret comparisons using the shared timing-safe helper | not checked | not checked | not checked | **helper exists; 5 call sites still use `===`** | **SEC-19 — low** |
| Copy-paste duplication across `src/` | not checked | not checked | not checked | **0.8%** (3,099 / 388,937 lines) | low overall; concentrated in QLT-09 |
| `console.*` in `src/`, and what replaces it in production | not checked | not checked | not checked | **2,410**, all stripped by esbuild; `structuredLogger` used in **0** app files | **REL-03** |
| Files within 10 lines of the 800-line ceiling | not checked | not checked | not checked | **11** (median file: 124 lines) | **QLT-10** |
| Unreferenced modules — re-checked | not checked | 88 files | 0 | **1 directory / 5 files / 461 lines** missed by the sweep | **QLT-11** |
| English toast titles in a Spanish-only UI | not checked | not checked | not checked | **226** `"Error"` vs 39 `"Éxito"` vs 38 `"Success"` | **QLT-12** |
| Icon-only controls with no accessible name below `sm` | not checked | not checked | not checked | **65 sites**, 15+ files with no `aria-label` | **A11Y-01 — new class** |
| Dependencies a major version behind / vulnerabilities | not checked | not checked | not checked | **24 major behind / 0 advisories** | **DEP-01** |
| `catch` blocks that swallow the error | not checked | not checked | not checked | **3 of 1,250** | healthy |
| `@ts-ignore` + `@ts-expect-error` across 337,985 lines | not checked | not checked | not checked | **4** | healthy — `strict` was reached at the type level |
| pgTAP files vs policied tables | not checked | not checked | ~40% | **25 files / 184 policied tables** | DB-02 |
| Test files per area | not checked | not checked | not checked | `utils` 100/236, `components` 96/549, `hooks` 24/145, **`stores` 0/4** | DB-02 / REL-02 |

### Governance gate detail — re-run 2026-09-06 on `7e4040b`

| Gate | Current | Baseline | Note |
| --- | ---: | ---: | --- |
| `ui-data-layer-client-import` | 176 | 176 | draining (213 → 195 → 176); QLT-03 still open |
| `scheduling-new-date` | 43 | 43 | draining (107 → 67 → 43) |
| `direct-protected-route-allowed-roles` | 0 | 0 | cleared |
| `pages-supabase-client-import` | 0 | 0 | held |
| File size >800 lines — `src/` | 0 | 0 | held |
| File size >800 lines — `supabase/functions/` | 6 | 6 | **new domain**; the six oversized functions are now budgeted rather than invisible |
| Lint warnings | 1,145 | 1,145 | now enforced at total, per-rule, per-domain and per-file |
| Legacy edge console sites | 560 in 80 files | frozen | **new gate**; new/unlisted sites fail |
| Mobile type floor | 241 | 241 | draining |
| Edge exposure classes | 14 public-token / 14 authenticated / 36 privileged / 7 service-only | — | all 71 classified |
| SECURITY DEFINER anon grants | 82 | 82 reviewed | **the gate replays migrations only. Production carries 75, and the two sets differ by 81 entries — see SEC-18** |
| GitHub Actions pinning | all pinned | — | held |
| **Storage buckets / `storage.objects` policies** | — | — | **no gate exists**; 21 buckets and 60+ object policies are outside every ratchet — see SEC-17 |

---

## What is healthy — measured, not assumed

An audit that lists only problems misrepresents the codebase, so these were measured on the same
commit and are worth stating plainly:

- **Duplication is genuinely low.** 0.8% (3,099 of 388,937 lines) by copy-paste detection, and
  almost all of it is the one department cluster in QLT-09. Outside that axis the codebase does not
  repeat itself.
- **Error handling is disciplined.** 1,250 `catch` blocks in `src/`, of which **3** are empty or
  comment-only. Errors are read through `getErrorMessage` rather than assumed to have `.message`.
- **`strict: true` was reached honestly.** Across 337,985 lines of `src/`: **3** `@ts-ignore` and
  **1** `@ts-expect-error`. The register's claim that strict was achieved at the type level rather
  than with casts holds up under measurement.
- **React Query is configured centrally**, not per-call-site — `createOptimizedQueryClient` sets
  `defaultOptions` including `gcTime`, and adjusts them on multi-tab leadership change. The 269
  `useQuery` sites that set no `staleTime` are inheriting a deliberate default, not drifting.
- **The service worker is correctly scoped.** Same-origin `GET` only, network-first for HTML and
  cache-first for content-hashed assets. No Supabase API or auth response is ever cached.
- **Client XSS surfaces are nearly clean.** Four `dangerouslySetInnerHTML` sites, three of them
  sanitised or static; no `eval`, no `new Function`; no hardcoded credentials in `src/`. QLT-08 is
  the single exception found.
- **The dependency audit is honestly zero** — not a baseline absorbing known advisories.

---

## Open findings

### SEC-17 — 1,273 files in *private* Storage buckets are downloadable with the public anon key

**Severity: critical. New in this pass — Storage was never enumerated by any previous audit.**

Every access-control effort so far has gone into `public` tables. Nothing has looked at
`storage.objects`, and that is where the exposure now lives.

Twenty-one buckets exist. Six are flagged `public`, which is a deliberate choice. The problem is
the other fifteen: seven of them carry a `SELECT` policy on `storage.objects` granted to the
`public` **role** with a predicate that is nothing but a bucket-id match — no `auth.uid()`, no
`auth.role()`, no ownership check. `anon` holds the table-level `SELECT` grant on
`storage.objects`, so those policies are satisfied by an unauthenticated caller.

Measured as `anon` (`SET LOCAL ROLE anon`, row counts on `storage.objects`):

| Bucket | `public` flag | Objects readable by `anon` | Policy that permits it |
| --- | --- | ---: | --- |
| `memoria-tecnica` | **false** | 596 | `Allow public to download files` |
| `festival_artist_files` | **false** | 519 | `riders_bucket_read_all` |
| `tour-documents` | **false** | 89 | `All users can view tour documents` |
| `festival-logos` | **false** | 36 | `Anyone can view festival logos` |
| `tour-logos` | **false** | 21 | `Anyone can read tour logos` |
| `lights-memoria-tecnica` | **false** | 10 | `Enable read access for all users`, `Public Access` |
| `company-assets` | **false** | 2 | `Allow public read access to company assets` |
| | | **1,273** | |

This is not a theoretical policy reading. Against the live project, holding **only the public
`anon` key** (which ships in the client bundle and is public by design):

- `POST /storage/v1/object/list/festival_artist_files` → **HTTP 200**, enumerating object names.
  The same call succeeds on `memoria-tecnica` (170 entries in one page), `tour-documents`,
  `lights-memoria-tecnica` and `company-assets`.
- `GET /storage/v1/object/festival_artist_files/<uuid>/<uuid>.pdf` with a range header →
  **HTTP 206, `content-type: application/pdf`**, real bytes returned.

Because listing works, the UUID-shaped object paths are not a secret — the caller does not need to
guess them. `festival_artist_files` holds artist technical riders; `memoria-tecnica` holds
technical documentation packages; `tour-documents` holds tour paperwork. All are business
documents that the bucket's own `public = false` flag says were meant to be private.

Separately, **one bucket accepts an unauthenticated write**. The policy `Enable insert access for
all users` is an `INSERT` policy for the `public` role with `WITH CHECK (bucket_id =
'lights-memoria-tecnica')` and no auth term. Confirmed by executing the insert as `anon` inside a
transaction that was rolled back — it succeeded and returned the row. That is arbitrary file
upload into project storage by anyone on the internet.

Three secondary observations from the same enumeration, all lower severity but worth folding into
the same cleanup:

- **Duplicate buckets.** `artist-files` (0 objects) alongside `artist_files` (1), and
  `job-documents` (482) alongside `job_documents` (783). Policies were written against one spelling
  and objects landed in the other, which is exactly how a policy gap survives review.
- **Policy accretion.** `memoria-tecnica` carries 15 overlapping `storage.objects` policies. RLS is
  a disjunction, so the most permissive one wins and the other fourteen are decoration that makes
  the effective grant hard to read.
- **A public bucket with no bucket-specific policy at all** (`public logos`, 20 objects) — it works
  only through the bucket's public flag, so its access is invisible to a policy review.

Reproduction queries and the exact HTTP probes are in
[`docs/security/2026-09-06-anon-reachability-evidence.md`](security/2026-09-06-anon-reachability-evidence.md),
so this can be re-checked before and after the fix without re-deriving it.

**Why no gate caught this.** Every governance ratchet reads `src/` or `supabase/migrations/` or
`supabase/functions/`. `storage.objects` policies are catalog state created largely through the
Supabase dashboard; nothing in the repository describes them, so nothing can compare them.

**Remediation.**
1. Replace each unconditional bucket-read policy with one that matches the bucket's intent —
   `auth.role() = 'authenticated'` at minimum, and preferably a join to the owning job/festival/tour
   for the document buckets. Where genuinely public delivery is needed, use a signed URL or set the
   bucket's `public` flag deliberately rather than leaving a private bucket world-readable.
2. Delete the `Enable insert access for all users` policy on `lights-memoria-tecnica`.
3. Consolidate the duplicate buckets and collapse the redundant policies, so the effective grant is
   one readable rule per bucket.
4. Bring `storage.objects` into the schema catalog that `scripts/ci/schema-catalog.sql` already
   exports, so this class becomes visible to DB-06's drift comparison instead of needing an audit
   to rediscover it.

### SEC-18 — `anon` can execute unguarded `SECURITY DEFINER` functions, and the gate that is supposed to prevent this replays migrations rather than reading production

**Severity: high. This is DB-06 with consequences, and it is the reason DB-06 must not be closed.**

`scripts/governance/check-security-definer-grants.mjs` is a good control with a documented promise:
"Functions whose EXECUTE is still granted to anon/PUBLIC after replaying all migrations. Each entry
is an accepted, reviewed exposure." It has two gaps.

**Gap one — the baseline describes the migration chain, not production.** Comparing the 82 baseline
entries against the live catalog:

- **75** `SECURITY DEFINER` functions in `public` are executable by `anon` on production.
- **37 of them are not in the baseline at all** — production grants that no migration in the
  repository creates.
- **44 baseline entries do not exist on production** — grants the replay predicts that were
  revoked out-of-band.

So the two sets disagree on 81 entries. The gate is green, and it is green about a schema that is
not the one running. Every finding below sits in the 37-entry drift set.

**Gap two — a grant on the baseline was never checked against the function body.** "Reviewed
exposure" was applied to the list, not to what each function does. Of the 47 non-trigger functions
`anon` can call (the other 28 return `trigger` and PostgREST will not expose them), at least five
carry no authorization check whatsoever. Because `SECURITY DEFINER` runs as the owner, RLS is
bypassed inside them:

| Function | What an unauthenticated caller gets |
| --- | --- |
| `mark_timesheet_auto_reminder_sent(uuid, timestamptz)` | Sets `reminder_sent_at` and increments `auto_reminder_count` on **any timesheet by id**. Body is a bare `UPDATE`. Also a blind oracle: `RETURN FOUND` confirms whether a given UUID is a real timesheet. |
| `update_tour_dates()` | Rewrites `tours.start_date` / `end_date` for **every tour**. Body is a bare `UPDATE ... FROM`. |
| `evaluate_user_achievements(uuid)` / `evaluate_daily_achievements()` | Triggers achievement evaluation and the writes it performs, for any user. |
| `prune_place_api_cache()` | Deletes rows from `place_api_cache`. |
| `extras_total_for_job_tech(uuid, uuid)` | Reads pay extras and their euro total for any job/technician pair, RLS bypassed. Confirmed executable as `anon` over HTTP (returns `{"items": [], "total_eur": 0}` for a non-existent pair rather than an authorization error). |

`find_policies_to_optimize()` is a sixth, lower-severity case: it returns the repository's table and
policy names to an unauthenticated caller — a map of the security model.

The guarded majority behave correctly and are worth recording as evidence the pattern is
understood: `rank_staffing_candidates` raises `Not authorized to rank candidates`,
`get_timesheet_amounts_visible` returns `[]`, `get_active_timesheet_counts_by_technician` returns
`[]`, `get_current_user_role` returns `null`. The problem is not the design; it is that five
functions were never brought into it, and the gate could not tell.

**Remediation.**
1. `REVOKE EXECUTE ... FROM anon, PUBLIC` on the five unguarded functions, plus
   `find_policies_to_optimize`, and grant explicitly to `authenticated` / `service_role` as each
   one's callers require. This is a migration, so the gate will track it.
2. Re-derive the baseline from **production**, not from the replay, and record the 37-entry
   difference as findings rather than absorbing it — otherwise regenerating the baseline would
   silently bless the drift.
3. Add a body check to the gate: a function on the anon-executable list must contain an
   authorization predicate, or carry an explicit reviewed annotation saying why it needs none
   (`get_public_artist_form_context`, `submit_public_artist_form` and `get_tour_guest_payload` are
   legitimately anon-facing and would be annotated).
4. Close the latent re-introduction path. `pg_default_acl` still holds a `supabase_admin`-granted
   default for `public` functions of `{anon=X, authenticated=X}`, and for `public` tables of
   `anon=arwdDxt`. The `postgres`-granted defaults were correctly tightened by
   `20260624120000_phase2_revoke_anon_rpc_execute.sql` and `20260905114927_reconcile_audited_catalog_drift.sql`;
   the `supabase_admin` ones were not. Nothing in `public` is currently owned by `supabase_admin`,
   so this is latent rather than active — but anything created through the dashboard as that role
   would be granted to `anon` automatically, which is precisely how a drift set like this one grows.

*Honest limit:* grants carry no timestamp, so the catalog cannot prove **when** or **how** the 37
drift grants were created. What it proves is that they exist on production and the migration chain
does not account for them.

### SEC-19 — five edge functions compare secrets with `===` while a timing-safe helper sits in `_shared`

**Severity: low. Small, and entirely mechanical to fix.**

`supabase/functions/_shared/auth.ts` exports `isServiceRoleRequest` / `requireServiceRoleRequest`,
built on a constant-time `timingSafeEqual`, and it is covered by `_shared/auth.test.ts`.
`hojaLinkToken.ts` has its own equivalent. `cleanup-corporate-email-images` uses the pattern
correctly. Five call sites still do not:

| File | Line | Comparison |
| --- | ---: | --- |
| `supabase/functions/staffing-orchestrator/index.ts` | 63 | `token === SERVICE_ROLE \|\| apikey === SERVICE_ROLE` — a local re-implementation of the shared helper, minus the timing safety |
| `supabase/functions/wallboard-feed/index.ts` | 160 | `sharedHeader !== WALLBOARD_SHARED_TOKEN` |
| `supabase/functions/wallboard-debug/index.ts` | 30 | `provided !== WALLBOARD_SHARED_TOKEN` |
| `supabase/functions/wallboard-auth/index.ts` | 72 | `token !== WALLBOARD_SHARED_TOKEN` |
| `supabase/functions/push/auth.ts` | 17 | `token === SERVICE_ROLE_KEY \|\| token === internal` |

Remote timing attacks over HTTPS are hard to land, so rank this on consistency rather than
exploitability: the codebase has decided how to compare secrets, and five places predate the
decision. `staffing-orchestrator` is the one to fix first — it is the only one that duplicated the
helper's logic rather than simply not knowing about it.

While in `wallboard-auth`: it also returns `e?.message` from its catch block to an unauthenticated
caller, and annotates the catch as `catch (e: any)` — which the project's own rule forbids
("Errors are `unknown`, not `any`") and which silently disables `useUnknownInCatchVariables`. Nine
files under `supabase/functions/` still carry that annotation.

### QLT-08 — one of three Mapbox popups interpolates database text into HTML unescaped

**Severity: low.**

`src/components/tours/scheduling/TourMapViewMapbox.tsx` defines a local `escapeHtml` and applies it
correctly in the home-base popup (line ~173) and the venue popup (lines ~232–236). The hotel popup
at line ~265 does not: `accommodation.hotel_name`, `hotel_address` and `rooms_booked` are
interpolated into a `setHTML(...)` template raw. `setHTML` assigns `innerHTML`, so a `<img
onerror=...>` stored in a hotel name executes in the browser of anyone who opens that popup.

Writes to `tour_accommodations` are restricted to `is_admin_or_management()`, so this is an
admin-to-technician stored XSS rather than a privilege escalation — an admin already holds broader
powers. It is worth fixing because it is a one-line inconsistency inside a function that already
demonstrates the correct pattern twice, which is how such gaps survive: the file looks safe.


### QLT-09 — the same feature is written once per department, across every layer of the stack

**Severity: medium as a defect, high as a cause. This is the mechanism behind the "partial
adoption" pattern this register keeps rediscovering.**

`department` is an enum with six values, and the codebase treats it as a copy-paste axis rather
than as data. The same feature exists three to five times, in parallel, at every layer:

| Layer | Parallel implementations | Lines |
| --- | --- | ---: |
| Components — Memoria Técnica | `sound/MemoriaTecnica.tsx` (704), `lights/LightMemoriaTecnica.tsx` (679), `video/VideoMemoriaTecnica.tsx` (671) | 2,054 |
| Components — task dialogs | `sound/SoundTaskDialog.tsx` (686), `video/VideoTaskDialog.tsx` (632), `lights/LightsTaskDialog.tsx` (629) | 1,947 |
| Edge Functions | `generate-memoria-tecnica`, `generate-lights-memoria-tecnica`, `generate-video-memoria-tecnica` | 285 |
| Tables — tasks | `sound_job_tasks`, `lights_job_tasks`, `video_job_tasks`, `production_job_tasks`, `administrative_job_tasks` | — |
| Tables — personnel | `sound_job_personnel`, `lights_job_personnel`, `video_job_personnel` | — |
| Tables — documents | `memoria_tecnica_documents`, `lights_memoria_tecnica_documents`, `video_memoria_tecnica_documents` | — |

Copy-paste detection over `src/` puts overall duplication at **0.8% (3,099 of 388,937 lines)**,
which is genuinely low — but nearly every large clone is in this cluster: 279 + 250 + 165 + 109 +
81 + 79 + 65 + 65 lines between the three Memoria Técnica components, and 267 + 119 between the
lights and video task dialogs. Outside the department axis, the codebase does not repeat itself.

**Why this matters more than its line count.** Three of this register's findings are the same
shape — a correct fix applied to one member of a parallel set:

- SEC-03 fixed the `ja.job_id = ja.job_id` self-comparison on `sub_rentals`; the identical bug
  survived on `festival_artists` until the 2026-09-04 pass found it.
- SEC-15 found seven email functions interpolating unescaped values while `escapeHtml` sat in
  `_shared`.
- QLT-08 (below) has two of three Mapbox popups escaping correctly and the third not.

Parallel implementations do not just cost lines; they convert every fix into a sweep, and every
missed sweep into a latent defect. Governance ratchets cannot see this class at all — each file is
individually under budget, individually linted, individually typed.

**Remediation.** Do not attempt this as one refactor. Take the Memoria Técnica triple first, since
it is the largest and its three copies are the most similar: extract the shared component with
department passed as a prop and the department-specific pieces as a config record, then collapse
the three edge functions onto one entry point with a `department` parameter. The parallel *tables*
are the deeper problem and a much larger change — record the intent, but the components and
functions deliver most of the benefit for a fraction of the risk.

### REL-03 — the app has no production observability at all

**Severity: medium. New in this pass, and it is a gap rather than a defect, which is why no gate
reports it.**

`src/` contains **2,410 `console.*` calls**. `vite.config.ts` sets `drop: ['console', 'debugger']`
for production builds. Both of those are individually reasonable; together they mean **every
diagnostic in the client is removed at build time and nothing replaces it**. When a user hits a bug
in production, there is no log, no breadcrumb and no error report — only the user's description.

The repository already built the answer and pointed it at the smaller half of the problem:
`structuredLogger` is adopted in **13 Edge Function files** and **0 application files**, and the
`check-edge-logging` governance gate freezes 560 console sites in `supabase/functions/` so that
migration can only move forward. There is no equivalent gate, and no equivalent migration, for the
2,410 sites in `src/` — four times the volume, on the tier where users actually experience failures.

Worth being precise about what is and is not wrong here: stripping `console` from production is
correct, and the absence of logs is not a data-exposure problem. The problem is that the decision to
strip was never paired with a decision about what production failures should look like instead.

**Remediation.** Decide the destination first — a client error reporter, or `structuredLogger`
writing to an existing endpoint. Then wire the top offenders (`useHojaDeRutaPersistence.ts` at 56
sites, `flexUuidService.ts` at 45, `useTimesheets.ts` at 45, `unified-subscription-manager.ts` at
32) and extend `check-edge-logging` to cover `src/` so the count can only fall. Error boundaries and
mutation `onError` handlers are the highest-value sites; ordinary debug logging can stay dropped.

### QLT-10 — the file-size ratchet holds a wall of files against the ceiling instead of causing decomposition

**Severity: low. Recorded because the gate is reported as green and the shape underneath is not.**

File length across `src/` (excluding the 12,994-line generated `types.ts`) is strongly bimodal.
Median file: **124 lines**. And then:

| Range | Files |
| --- | ---: |
| 790–800 lines | **11** |
| 750–800 lines | **40** |
| 700–800 lines | 60 |
| over 800 | 3 (all generated or test fixtures) |

Eleven files sit within ten lines of the 800-line limit — `Profile.tsx` at exactly 800,
`AmpRackDesigner.tsx` at 799, then four files at 798. That distribution is not what natural code
length looks like; it is what a ceiling looks like. The gate is doing the job it was given (nothing
grows past 800) but the job it was assumed to be doing (files get decomposed) is not happening —
work is being trimmed to fit instead.

This was visible during the SEC-13 work in this very register: `Profile.tsx` crossed 800, and the
resolution was to extract one hook and land at exactly 800 rather than to reconsider the file.

**Remediation.** Not more gate. Either add a second, lower advisory threshold that reports without
failing (so the trend is visible), or accept the ceiling as a growth brake and stop reading it as a
decomposition signal. Recording which of the 40 near-ceiling files are genuinely cohesive and which
are accretions would be more useful than another number.

### QLT-11 — a completed component decomposition sits unreferenced beside the file it was meant to replace

**Severity: low, but it is a miss by an existing control.**

`src/components/ui/sidebar.tsx` is 774 lines and is the only version anything imports
(`src/components/layout/Layout.tsx:17`). Beside it, `src/components/ui/sidebar/` holds a finished
five-file decomposition of the same component — `sidebar-components.tsx` (221),
`sidebar-context.tsx` (120), `sidebar-layout.tsx` (69), `sidebar-menu.tsx` (34), `index.tsx` (17),
**461 lines** — that nothing in the repository reaches. Copy-paste detection flags 93 duplicated
lines between the two.

The 2026-09-05 dead-code sweep reported **0 unreferenced modules**. It missed this because
`@/components/ui/sidebar` is ambiguous: TypeScript and Vite both resolve `sidebar.tsx` in
preference to `sidebar/index.tsx`, so the directory looks like a live barrel export to a
module-graph walk while resolving to nothing in practice.

**Remediation.** Finish or delete. If the decomposition is the intended end state, point `Layout`
at it and remove `sidebar.tsx`; otherwise delete the directory. Either way, teach the dead-code
sweep about file-beats-directory resolution, or this class stays invisible.

### QLT-12 — the Spanish-only UI has an English toast convention

**Severity: low, but it is the most-seen text in the product.**

The project rule is explicit: Spanish is the only supported UI language. Toast titles do not follow
it, and they do not follow anything else either:

| Toast title | Occurrences |
| --- | ---: |
| `title: "Error"` | **226** |
| `title: "Éxito"` | 39 |
| `title: "Success"` | 38 |

So the dominant pattern is an English title over a Spanish body — `title: "Error"`,
`description: "No se pudo actualizar el turno"` — with a Spanish minority and an English minority
underneath it. Alongside these, roughly 70 hardcoded English strings remain in components
(`Save`, `Cancel`, `Delete`, `Close`, `Loading...`), and 47 toasts are English end to end
(`"Failed to export PDF."`).

Credit where due: Zod validation messages, which the project rule calls out as a common miss, are
consistently in Spanish.

**Remediation.** This is a find-and-replace with a decision attached, not a refactor: pick
`"Error"` / `"Éxito"` and apply it in one pass, then add a `/i18n-check`-backed gate so the count
cannot climb again. The 226-instance majority means the cheapest correct answer may be to keep
`"Error"` as a deliberate loanword and normalise `"Success"` → `"Éxito"`; what matters is that it
stops being three conventions.

### A11Y-01 — icon-only controls lose their accessible name at mobile width

**Severity: medium. An entirely new class — no previous pass examined accessibility.**

The pattern `<Icon /><span className="hidden sm:inline">Label</span>` appears at **65 sites**. Below
the `sm` breakpoint the span is not rendered, so the button has no text content — and at least 15
of those files contain no `aria-label` anywhere, meaning the control has **no accessible name at
all** on a phone. That is WCAG 4.1.2 (Name, Role, Value), and `getByRole("button", { name })`
cannot find these controls either.

Affected files include `JobCard.tsx`, `TourManagement.tsx`, `FestivalManagementView.tsx`,
`FestivalArtistManagement.tsx`, `FestivalGearManagement.tsx` and six job-card actions — primary
navigation and primary actions, not edge cases.

Two things make this worse than a typical a11y nit here. The product is a mobile-first PWA, so the
broken width is the main one. And CI runs the whole e2e suite at 390 px (`test:e2e:mobile`), so the
viewport where these controls are nameless is already exercised — the suite simply does not assert
accessible names.

**Remediation.** Add `aria-label` containing the visible text at each of the 65 sites; it is
mechanical. Then make it stick: an ESLint rule, or an axe assertion in the mobile e2e run, so the
count is enforced rather than fixed once. Given no accessibility review has ever been done here, a
broader audit (focus order, contrast, form labelling, dialog focus traps) is worth scheduling
separately — this finding is what one narrow grep surfaced, not a considered assessment of the
whole product.

### DEP-01 — 24 dependencies are a major version behind, with zero vulnerabilities

**Severity: low now, and it compounds.**

`npm audit` is clean and the baseline is genuinely zero — that half is in good shape. The other half
is that 43 packages are behind, **24 of them by a major version**:

| Package | Current | Latest |
| --- | --- | --- |
| `react` / `react-dom` | 18.3.1 | 19.2.8 |
| `@types/react` / `@types/react-dom` | 18.3.31 | 19.2.18 |
| `react-day-picker` | 8.10.2 | 10.0.1 |
| `@hookform/resolvers` | 3.10.0 | 5.9.1 |
| `@vitest/coverage-v8` | 3.2.7 | 5.0.0 |
| `jsdom` | 29.1.1 | 30.0.1 |
| `@vitejs/plugin-react-swc` | 3.11.0 | 4.3.3 |
| `lucide-react` | 0.462.0 | 1.41.0 |

`date-fns` (3.6.0 → 4.4.0) is a deliberate, documented pin for `react-day-picker` compatibility and
should stay put. The rest are not decisions, they are drift — and they interlock: React 19 pulls the
type packages, the SWC plugin and probably `react-day-picker`, so the longer it waits the more it
becomes one large simultaneous upgrade instead of several small ones.

The `--legacy-peer-deps` requirement is the symptom worth watching. It exists because the graph
cannot resolve cleanly today, and it also hides the peer conflicts that would tell you which
upgrades are now coupled.

**Remediation.** Do not treat this as one task. Take the leaves first — `jsdom`, `@vitest/*`,
`@testing-library/jest-dom`, `lucide-react` — where the blast radius is the test suite and CI tells
you immediately. Then plan React 19 as its own piece of work with its own branch and full e2e run;
`react-day-picker` and the `date-fns` pin should be re-evaluated as part of it, not before.

### SEC-16 — a technician still reads full profile rows for every shared-job colleague

**Severity: medium. New on 2026-09-05, and it is the residual of SEC-13's fix rather than a
regression.** `profiles_select` is now correlated:

```
id = auth.uid()
OR current_user_role() = ANY (ARRAY['admin','management','logistics'])
OR EXISTS (caller and target share a job_assignment)
```

That third branch returns the **whole row**, so `dni`, `residencia`, `phone` and `email` remain
readable for every colleague the caller has ever shared a job with. Measured on production:

| Metric | Value |
| --- | ---: |
| Accounts with shared-job reach | 175 |
| Average colleagues visible | 55 |
| **Maximum colleagues visible to one technician** | **134 of 313 (43%)** |
| Non-null `dni` among one sampled technician's 103 visible rows | 102 |

This is a large improvement on 313-of-313 and the credential is entirely gone from the row, so it
is not a P0. But `get_profile_directory()` — which returns exactly the safe projection and
deliberately excludes email, phone, DNI and residence — is an *alternative* a caller may choose,
not a *constraint* the policy imposes. Any colleague-facing query that goes to `profiles` directly
still gets the sensitive columns.

**Remediation.** Inventory the colleague-facing reads (the assignment matrix, staffing, messaging,
wallboard) and move them onto `get_profile_directory()`; then drop the shared-job branch from
`profiles_select` so the sensitive columns are reachable only by the owner and by
admin/management/logistics. Add a pgTAP case asserting a technician reads zero rows for a
colleague they share a job with, once the directory is the only path. Doing it in that order keeps
the UI working at every step.

### DB-06 (residual) — drift detection is instrumented but not gated, and drift has already resumed

The substance landed: `scripts/ci/schema-catalog.sql` exports policies, RLS flags, view and
function fingerprints, trigger definitions and table/function/column ACLs under stable object
identities; `compare-schema-catalog.mjs` diffs two catalogs and refuses empty, duplicate or
cross-major inputs; `docs/security/schema-drift-verification.md` records the procedure and the
first real production comparison — **199 object differences, zero policy differences** — and the
reconciliation migration has been applied (verified: `set_job_created_by` and the jobs attribution
trigger now exist on production, client `TRUNCATE`/`REFERENCES`/`TRIGGER` grants are gone, and all
206 repository migrations are applied).

What is not closed: the CI step runs

```
node scripts/ci/compare-schema-catalog.mjs schema-catalog.json schema-catalog.json
```

— the artifact against itself. That proves the exporter and comparator execute, and it publishes
the artifact for manual comparison, but it cannot detect drift, because PR CI deliberately never
contacts production. So drift is caught only when a human downloads the artifact and runs the
comparison as a release step.

**Updated 2026-09-06 — this is no longer hypothetical.** The 2026-09-05 comparison found zero
*policy* differences and was reconciled. Function *privileges* were not compared, and they diverge:
the migration-replay baseline and production disagree on 81 `anon` EXECUTE grants (37 live-only,
44 replay-only), and five of the live-only grants expose functions with no authorization at all.
SEC-18 records the detail. That is drift producing a real, currently-reachable finding between one
audit pass and the next, in exactly the window the missing gate leaves open. The same argument now
extends to a second uncovered surface: `storage.objects` policies are not in the catalog export at
all, which is why SEC-17 needed an audit to find rather than a gate.

**Remediation.** The cheap option — recording the manual comparison as a release-checklist item —
is no longer sufficient on its own, because the drift arrived without anyone noticing across two
audit passes that were both looking. Add a scheduled workflow holding a read-only production
connection that runs the real comparison on a cadence and fails loudly on any policy **or ACL**
difference, and extend `scripts/ci/schema-catalog.sql` to cover `storage.buckets` and
`storage.objects` policies. Keep the checklist item as well; it costs nothing and covers the gap
between scheduled runs.

### SEC-09 (partial) — structured logging is adopted at the boundaries, not throughout

The confirmed PII cases are fixed — `send-password-reset` no longer logs anything, and
`structuredLogger` now has 8 importers where it had none. A new `check-edge-logging` governance
gate lints `supabase/functions/**` for `no-console`, freezes the legacy sites in
`legacy-console-allowlist.json`, and fails on any new or unlisted site, so the remaining debt can
only shrink.

**560 console sites across 80 files remain.** That is now a ratcheted migration rather than an open
wound, and the gate's own rationale is explicit that freezing is "not approval to log PII". The
residual work is to keep draining it, prioritising functions that handle identifiers.

### QLT-03 — the legacy data-layer boundary is still draining

176 `dataLayerClient` imports in pages and components, down from 213 → 195 → 176. No acute risk;
steady structural work.

### PERF-01 — bundle headroom is still short of target

3.10 MB gzip against a 3.32 MB ceiling: **6.6% headroom** where PERF-01 asks for 15%. `maps-lib`
(~510 kB), `pdf-libs` (~342 kB) and `spreadsheet-libs` (~265 kB) still dominate. Unchanged in
substance since July.

### DB-02 — pgTAP breadth still trails the policied schema

The suite has grown (new files for anonymous catalog access, profile/rate visibility, staffing
summary, calendar-token isolation, schema attribution) and now covers the tables this audit
touched. It still does not approach 100% of the 184 policied tables, and the catalog comparison
explicitly "does not test application row visibility or replace pgTAP".

---

## Closed and verified on production — 2026-09-05

Each row was re-measured against the live database or a re-run gate, not inferred from the diff.

| ID | What was wrong | What closed it | Measured proof |
| --- | --- | --- | --- |
| **SEC-13** | `profiles_select` was `USING (true)`: 313 rows readable by any account, including 313 ICS bearer tokens and 286 national IDs | #920 moved tokens to an owner-scoped vault with client writes revoked and rotated every one; #920 narrowed `profiles_select` and added `get_profile_directory()` | Claimless authenticated session reads **0** profile rows and **0** vault rows; legacy column holds **0** non-null tokens; a real technician reads exactly their shared-job set (103 = 103) and exactly **1** vault row |
| **SEC-12** | Ten SELECT policies short-circuited via `true OR …`; three tables readable with the public anon key, `festival_artists` at 598 rows; `ja.job_id = ja.job_id` self-comparison | #920 and #929 rewrote the predicates, corrected the correlation and revoked `anon` grants | Anon sweep over every `anon`-SELECTable table returns rows from **one** table (`activity_catalog`, 54, deliberate); **0** policies contain `true OR`/`OR true`; `rate_cards_2025` SELECT is now `is_admin_or_management()` |
| **SEC-15** | Seven email functions interpolated user-controlled values into HTML with no escaping | #928 | **0** email functions build HTML without `escapeHtml`/sanitiser |
| **QLT-05** | The file-size gate scanned only `src/`, so six Edge Functions over 800 lines were invisible | #927 split the budget into two domains | Gate reports both domains; `supabase/functions/` baselined at 6 |
| **QLT-07** | 88 unreferenced app modules, ~13,955 LOC, including five components July had already flagged | #925 | Sweep finds **0** app-owned dead modules; only `src/stubs/html2canvas-unused.ts` remains, which is an intentional Rollup alias target |
| **QLT-01 (gate)** | `check-lint-warning-baseline.mjs` enforced only per-file ceilings; `baseline.total` was printed, `baseline.rules` never read | #927 added `lint-warning-policy.mjs` | Budgets enforced at total, per-rule, per-domain, per-domain-rule and per-file |
| **REL-02** | Coverage thresholds existed for 5 files and no workflow ran coverage | #927 | 10 thresholds including every shared trust boundary (`auth`, `rateLimit`, `hojaLinkToken`, `emailHtmlPolicy`, `memoriaSecurity`), executed in CI because `test:critical` chains `test:critical:coverage` |
| **DB-06 (substance)** | 552 live policies vs 590 replayed, undiagnosed, with four cited body differences | #924 built the normalized exporter/comparator and applied a reconciliation migration | Production comparison found 199 object differences and **zero** policy differences; reconciliation verified applied; **206/206** repository migrations applied |
| — | Staffing summary view was directly reachable | #922 | `v_job_staffing_summary` has no grants to `anon` or `authenticated` |
| — | Offline cache retained private state across accounts and accepted cached fallback for authorization errors | #923 | Not independently re-verified here — see Method and limits |
| — | Expense edit permission bypass | #929 | Not independently re-verified here — see Method and limits |

Also verified still holding from the July → September closures: `strict: true` type-checks clean;
enforced CSP with no `unsafe-eval` and no `unsafe-inline` in `script-src`; `image-proxy` retired;
dependency audit at zero; **141 SECURITY DEFINER functions, 0 with an unpinned `search_path`**;
only two `anon`-targeted policies remain (`activity_catalog_read` and `system_errors_insert`, a
write-only error sink).

### One class worth an explicit decision

Fifteen `USING (true)` SELECT policies remain, all scoped to `authenticated` except
`activity_catalog` (anon + authenticated, deliberate). Most are reference data. Two are not:
`jobs_select` and `job_assignments_select` make the entire job book and assignment history readable
by every authenticated account. That is plausibly intended for this product — and
`job_assignments` being broadly readable is what makes the new correlated `profiles_select` work —
but it is currently intent-by-inheritance rather than a recorded decision. Worth confirming, then
either documenting or narrowing.

---

## Next moves — prioritized register

Ranked by risk removed (or future defects prevented) per unit of effort. Re-ranked 2026-09-05:
everything above the line in the previous register has shipped.

| # | ID | Move | Why it ranks here | Effort | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| 1 | **SEC-17** | Replace the seven unconditional bucket-read policies on `storage.objects`, delete the unauthenticated-insert policy on `lights-memoria-tecnica` | 1,273 files in buckets explicitly marked `public = false` are listable and downloadable by anyone holding the public anon key — proven end to end, not inferred. Nothing else open in this register is reachable without credentials | S per policy; M to do the set properly with the join predicates the document buckets deserve | An unauthenticated `list` and `object` request returns 403 for every `public = false` bucket; the anon insert path is gone; pgTAP or a probe script asserts both |
| 2 | **SEC-18** | Revoke `anon` EXECUTE from the five unguarded functions, then re-derive the grant baseline from production rather than from the replay | Unauthenticated writes to `timesheets` and `tours`, and an unauthenticated read of pay extras. The gate reports this as reviewed and green because it reads the migration chain | S (the revokes) / M (re-derive + add the body check to the gate) | The five functions return 401/403 to `anon`; the baseline is generated from the live catalog; a function on the anon list without an authorization predicate fails CI |
| 3 | **DB-06 (residual)** | Add the scheduled read-only production comparison, and extend the catalog export to `storage.*` | Both findings above are the same root cause: production state that no gate reads. Fixing the two instances without closing the mechanism just resets the clock to the next audit | M | A policy or ACL difference between replay and production fails something a human sees, on a cadence; `storage.objects` is in the catalog |
| 4 | **SEC-16** | Move colleague-facing reads onto `get_profile_directory()`, then drop the shared-job branch from `profiles_select` | Still the largest exposure of personal data *to authenticated users*: one technician can read up to 134 colleagues' `dni`, `residencia`, `phone` and `email`. It ranks below the three above only because it needs a valid login | M (do the migration to the RPC first, the policy narrowing second, so the UI never breaks) | A technician reads 0 rows from `profiles` for a shared-job colleague; pgTAP asserts it; colleague-facing UI unchanged |
| 5 | **A11Y-01** | Add `aria-label` at the 65 icon-only sites, then assert accessible names in the mobile e2e run | Mechanical, and it fixes primary navigation on the viewport this product is built for. CI already runs at 390 px — it just does not assert | S (the labels) / S (the assertion) | Every icon-only control has an accessible name at 390 px; an axe or role-name assertion fails if one regresses |
| 6 | **QLT-09** | Collapse the Memoria Técnica triple (components, then the three edge functions) onto one department-parameterised implementation | ~4,000 lines of parallel code is the mechanism behind three of this register's own findings — every fix here is a sweep, and a missed sweep is a latent defect | L; do the components first, leave the parallel tables recorded but untouched | Three components and three functions become one each; the `*_job_tasks` split is documented as a deliberate remaining decision |
| 7 | **REL-03** | Choose a production error destination, wire the top offenders, extend `check-edge-logging` to `src/` | Client failures in production are currently invisible: 2,410 diagnostics, all dropped at build, nothing behind them | M | Error boundaries and mutation `onError` reach a real sink; the `src/` console count is gated and falling |
| 8 | **SEC-09** | Keep draining the 560 frozen console sites, identifier-handling functions first | Ratcheted and safe, but 80 files still log through an unstructured path | L, incremental | `legacy-console-allowlist.json` shrinks each release; no function handling identifiers remains on the list |
| 9 | — | Confirm or narrow org-wide `jobs_select` / `job_assignments_select` | Currently intent-by-inheritance; the correlated `profiles_select` depends on it, so decide deliberately rather than discover later | S (decision) | Either a recorded rationale or a narrowed policy with pgTAP |
| 10 | **PERF-01** | Route-level budgets for the map, PDF and spreadsheet chunks | 6.6% headroom against a 15% target; no acute risk, but the ceiling is approached rather than defended | M | Headroom ≥15%, or per-route budgets replacing the single global ceiling |
| 11 | **QLT-03** | Continue draining the 176 legacy data-layer imports | Steady structural work, no acute risk | L, incremental | Baseline falls each release |
| 12 | **DB-02** | Extend pgTAP toward the untested half of the 184 policied tables | The catalog comparison explicitly does not test row visibility, so pgTAP remains the only behavioural check | L | Deny coverage for every table holding personal or financial data |

Items 1–3 are the ones worth doing next, and they are one piece of work in three parts. Items 1
and 2 are the only findings in this register reachable **without any credentials**; item 3 is the
mechanism that let both of them exist unnoticed while every gate stayed green. Fixing 1 and 2
without 3 buys until the next audit.

SEC-19, QLT-08, QLT-11 and QLT-12 are small enough to ride along with unrelated work rather than
earn their own change. DEP-01 is not urgent but should be started as leaves-first maintenance now
rather than deferred into a single React 19 cliff; QLT-10 is an observation about how to read an
existing gate, not work.

---

## Method and limits

- Numbers are produced by running the command or query at the stated date. Commands re-run for the
  **2026-09-06** pass on `7e4040b`: `npm ci --legacy-peer-deps`, `lint`, `typecheck`, `test:run`
  (380 files / 2,101 tests) and the full `governance` chain — all green. `build`, `budget:bundle`,
  `typecheck:functions` and Playwright were not re-run; CI covers them and neither had changed in
  a way this pass examined.
- The 2026-09-06 pass deliberately went to ground the earlier passes never covered, on two axes.
  *Security:* Storage buckets and `storage.objects`, the privilege catalog (`pg_default_acl`,
  `has_function_privilege`) as distinct from the policy catalog, the service worker's caching
  strategy, client XSS sinks (`dangerouslySetInnerHTML`, `innerHTML`, `setHTML`), and the tokenized
  public surfaces. *Quality and reliability:* copy-paste detection over `src/` (jscpd, 40-line /
  150-token minimum), file-length distribution against the 800-line gate, module reachability
  re-checked by hand, `console.*` volume against the production `drop` config and `structuredLogger`
  adoption, `npm outdated` against the manifest, hardcoded-English and toast-title counts, and a
  grep-level accessibility check of icon-only controls.
- Some things came back clean and are recorded as such rather than omitted: the service worker
  (same-origin `GET` only, no API or auth response cached), client XSS (QLT-08 the single
  exception), silent catch blocks (3 of 1,250), strict-mode escape hatches (4 in 337,985 lines),
  and React Query configuration (central defaults, so the 269 call sites without `staleTime` are
  inheriting a deliberate value — an early reading of that as drift was checked and dropped).
- **Accessibility has never been audited in this repository**, and A11Y-01 is what a single narrow
  grep surfaced, not a considered assessment. Focus order, contrast, form labelling and dialog
  focus traps are unexamined. Treat the finding as evidence that a real accessibility review is
  owed, not as its result.
- **SQL findings are verified against the live production database**, not inferred from the
  migration chain, using read-only catalog queries plus role-impersonated (`SET LOCAL ROLE anon` /
  `authenticated`) row counts. This matters: in the 2026-09-04 pass the same check overturned two
  findings that a migration replay had produced.
- The 2026-09-06 pass added **unauthenticated HTTP probes** — Storage `list`/`object` and PostgREST
  `/rpc/` calls carrying only the public `anon` key — so SEC-17 and SEC-18 rest on observed
  responses rather than on reading policy text. Probes were confined to reads. The one write
  finding (`anon` insert into `lights-memoria-tecnica`) was demonstrated with a transaction that
  was rolled back, and no production data was modified at any point in this audit.
- **Not independently re-verified in this pass:** the offline account-scoping and cancellation
  fixes (#923) and the expense edit permission fix (#929). Both are application-behaviour changes
  rather than catalog state, so confirming them needs an authenticated end-to-end exercise rather
  than a database query. They ship with their own tests and are recorded as closed by their PRs,
  not by measurement here.
- `npm run typecheck:functions` and the Playwright suite were not run in this pass. CI covers both;
  the sandbox's Chromium revision does not match the pinned Playwright.
- The replay-versus-production distinction remains the central methodological caution. Treat the
  migration chain as intent and `pg_policies` / `pg_proc` / `information_schema` as truth, and note
  that CI's catalog comparison currently compares an artifact against itself — see DB-06.
