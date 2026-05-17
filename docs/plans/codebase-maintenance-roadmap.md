# Codebase Maintenance Roadmap

**Snapshot date:** 2026-05-13
**Baseline:** `main == origin/main` at `74433cb722ea1e85b7f647af28471aba2d6bbd22`
**Change type:** Roadmap plus maintenance follow-through. No database schema, generated type, dependency, or intended UI behavior changes.

This roadmap turns the current maintenance audit into concrete, sequenced backlog tasks. The goal is a clean, maintainable, optimized codebase with explicit workstreams for type safety, data-layer consistency, monolith reduction, performance, Supabase operations, and legacy cleanup.

## Audit Snapshot

| Area | Current baseline |
| --- | --- |
| Lint | `npm run lint` passes with `0` errors and `439` warnings. |
| TypeScript | `npx tsc --noEmit --pretty false -p tsconfig.app.json` fails with `342` primary error lines. |
| File size | `1232` app code files counted; `288` files exceed 300 LOC; `49` files exceed 800 LOC. |
| Supabase access | `1320` direct Supabase call hits in `334` `src` files; `781` hits are in components/pages. |
| Loose typing | `541` `as any` casts in `171` files; `2` files still use `@ts-nocheck`. |
| Query keys | `741` inline `queryKey: [...]` hits versus `76` query-key factory references. |
| Date handling | `1089` `new Date(` hits in `320` files. |

### Resolved or Superseded Findings

- Persistent security audit logging is already implemented through `public.security_audit_log`, `supabase/functions/security-audit`, and `src/lib/security-audit.ts`. The older note that security events only went to `console.log` is superseded.
- Previously flagged unchecked delete paths in equipment and logistics now check Supabase errors before continuing.
- Flex folder creation for tour dates now checks the relevant `flex_folders` insert errors and throws on failure.
- Older audit line counts are superseded by this 2026-05-13 snapshot. Use the metrics above as the baseline for future progress tracking.

### Progress Started From This Roadmap

- 2026-05-13: P6-02 started by removing the obsolete `src/utils/pdf/tourLogoUtils.ts` compatibility re-export and pointing tour PDF imports at `src/utils/pdf/logoUtils.ts`.
- 2026-05-13: P2-04 completed for active app code by adding shared permission role groups, predicates, and `usePermissions`; replacing scattered admin/management checks across routes, pages, hooks, layout, jobs, matrix, tours, SoundVision, timesheets, and legacy wrappers; and adding focused permission tests. The remaining `admin`/`management` scan hits are central helpers plus test fixtures.
- 2026-05-15: P6-03 completed for `src` and `supabase` by removing unused placeholder code, replacing open source TODO/FIXME/HACK notes with roadmap task references, and cleaning scan false positives. `rg -n "TODO|FIXME|HACK|XXX" src supabase` now returns no matches.
- 2026-05-15: P0-01 completed by regenerating `src/integrations/supabase/types.ts` from linked project `syldobdcdsgfgjtbuwxm` with `npx supabase gen types typescript --linked --schema public`. The generated schema now includes the tracked drift examples: `resource_id`, `dryhire_parent_folders`, `get_public_artist_form_context`, `clear_whatsapp_group_request`, `rank_staffing_candidates`, `replace_hoja_de_ruta_all`, custom travel-rate columns, and invoicing-company fields. Follow-up local type fixes removed the obsolete Hoja de Ruta RPC cast and aligned stock/tour-rate call sites with the regenerated fields. `npx tsc --noEmit --pretty false -p tsconfig.app.json` still fails with 277 remaining diagnostics; none reference the P0-01 missing schema/RPC/column examples.
- 2026-05-16: P0-02 completed by clearing the app no-emit TypeScript baseline and adding `npm run typecheck` as `tsc --noEmit --pretty false -p tsconfig.app.json`.
- 2026-05-16: P0-03 completed through explicit safety disablement rather than unverified manufacturer substitution. `src/data/trussModels.ts` documents the unverified legacy constants, truss models default to `allowablesVerified: false`, `solveTrussWithTilt` suppresses moment/deflection pass-fail unless a model is explicitly verified, and rigging PDFs render unverified checks as `No validado` instead of `OK` or `FALLA`.
- 2026-05-16: P0-04 completed for the unsupported-state path. Flex business-role mappings now expose structured lookup diagnostics, sound keeps confirmed dictionary IDs, lights/video remain unsupported until IDs are confirmed, and `sync-flex-crew-for-job` returns `business_role_diagnostics` instead of silently omitting missing roles.
- 2026-05-16: Phase 1 completed across P1-01 through P1-05. Tour scheduling PDF exporters compile without `@ts-nocheck`; the `src` `as any` count dropped from the post-P0 baseline of `529` to `325`; dynamic Supabase/task/Flex/staffing access now uses narrowed table unions or typed wrappers; festival gear JSON normalization is centralized in `src/utils/festivalGearMappers.ts`; `tsconfig.app.json` now enables `noImplicitAny`; and CodeRabbit follow-up added additive transactional RPCs for tour requirement/logistics replacement writes. Local validation passed with `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, `npm run cap:sync`, and `git diff --check`.
- 2026-05-16: Phase 2 completed across P2-01 through P2-05, retaining the already-complete P2-04 permission layer. Component/page direct Supabase call hits were reduced from the post-Phase-1 scan of `318` to `12`; inline `queryKey: [...]` property arrays were replaced with `queryKeys` factories and now scan at `0`; repeated tour-management mutation toast/invalidation boilerplate now uses `useMutationFeedback`; wallboard calendar windows use Europe/Madrid date-key utilities; and timezone tests cover Madrid spring and autumn DST boundaries. Local validation passed with `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, `npm run cap:sync`, and `git diff --check`.
- 2026-05-16: P3-01 completed by splitting `src/components/technician/DetailsModal.tsx` from `2050` lines into a `79` line shell plus `src/components/technician/details-modal/` modules for modal data loading, document actions, formatting helpers, shared types, and tab sections. Added focused regression tests for formatter behavior, document open/download actions, and the Info/Documents tab render paths. Local validation passed with `npm run typecheck`, targeted Vitest coverage, `npm run lint`, `npm run test:run`, `npm run build`, `npm run cap:sync`, and `git diff --check`.
- 2026-05-16: P3-02 completed by splitting `src/components/jobs/cards/JobCardActions.tsx` from `1858` lines into a `210` line shell plus `src/components/jobs/cards/job-card-actions/` modules for production/warehouse WhatsApp, Flex opening and selector hosting, technical power packs, shared action formatting, action buttons, and dialogs. Existing Flex and technical-power tests remain in place, and focused smoke coverage now covers transport, document/upload actions, warehouse WhatsApp, and production WhatsApp dialog generation. Local validation passed with `npm run typecheck`, targeted Vitest coverage, `npm run lint`, `npm run test:critical`, `npm run test:run`, `npm run build`, `npm run cap:sync`, `npm run test:e2e`, and `git diff --check`.
- 2026-05-16: P3-03 completed by splitting `src/utils/flex-folders/folders.ts` from `1631` lines into a `1` line compatibility entrypoint plus `src/utils/flex-folders/folder-creation/` modules for orchestration, dryhire creation and cleanup, tourdate creation, standard job creation, commercial extras, shared helpers, and shared creation types. The new creation boundary also uses a Flex-folder-specific job type instead of preserving the broad legacy `any`. Local validation passed with `npm run typecheck`, targeted Flex folder Vitest coverage, `npm run lint`, `npm run test:critical`, `npm run test:run`, `npm run build`, `npm run cap:sync`, `npm run test:e2e`, and `git diff --check`.
- 2026-05-16: P3-04 completed by adding `src/features/technical-tools/` modules for shared Consumos power calculations, PDU recommendations, power/default/override payload builders, report upload/task-completion wrappers, Pesos weight calculations, and reusable power table controls. Sound/lights/video Consumos pages and sound/video Pesos pages now share the core calculation and persistence paths while preserving department-specific labels, component catalogs, PDF titles, and upload categories. Focused coverage includes power math, mixed-light apparent power, payload shape, upload failure versus non-fatal task-completion failure, weight totals, rigging-point formatting, and shared control labels. Local validation passed with `npm run typecheck`, targeted technical-tool and power-summary Vitest coverage, `npm run lint`, `npm run test:critical`, `npm run test:run`, `npm run build`, `npm run cap:sync`, `npm run test:e2e`, and `git diff --check`.

## Phase 0: Safety and Type Baseline

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P0-01 | Supabase generated types | Regenerate `src/integrations/supabase/types.ts` from the linked current schema, or apply a deliberate compatibility patch if generation is blocked. | Type errors caused by missing tables, RPCs, and columns are gone or tracked with a documented temporary adapter. Known examples include `resource_id`, `dryhire_parent_folders`, `get_public_artist_form_context`, `clear_whatsapp_group_request`, `rank_staffing_candidates`, and custom rate columns. | `npx tsc --noEmit --pretty false -p tsconfig.app.json`; targeted smoke checks for affected workflows. | Supabase CLI auth and correct project link. |
| P0-02 | Type-check gate | Add an `npm run typecheck` script only after the current no-emit check is clean. | CI can run `npm run typecheck` without failing on existing debt. The script uses `tsc --noEmit --pretty false -p tsconfig.app.json`. | `npm run typecheck`; CI dry run. | P0-01 and the highest-volume type fixes. |
| P0-03 | Rigging calculations | Low priority while the rigging calculator is not in active use. Before reactivation, replace unverified truss model constants in `src/data/trussModels.ts` with manufacturer-sourced values, or disable capacity/deflection pass-fail display until validated. | No safety-critical calculation presents placeholder values as reliable once the tool is used again. Source references or disablement rationale are documented near the constants. | Unit tests for rigging solver inputs; manual review by the responsible technical owner before reactivation. | Product decision to reactivate the calculator, then manufacturer datasheets or explicit disablement. |
| P0-04 | Flex role mappings | Complete lights/video Flex business-role dictionary IDs in `supabase/functions/_shared/flexBusinessRoles.ts`, or document and handle the unsupported state. | Flex crew sync does not silently omit business roles for lights/video. Missing IDs return clear diagnostics. | Function-level tests or staging sync dry run for sound, lights, and video. | Confirmed Flex dictionary IDs. |

## Phase 1: Type Debt and Generated Schema Hygiene

**Status:** Complete as of 2026-05-16. Phase 1 landed as one systematic cleanup pass after Phase 0, with additive Supabase RPC migration support for atomic tour requirement/logistics replacement writes and no intended user-facing behavior changes.

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P1-01 | PDF exports | Remove `@ts-nocheck` from `src/utils/tour-scheduling-pdf.ts` and `src/utils/tour-scheduling-pdf-enhanced.ts`. | Both files compile without suppressing TypeScript. jsPDF and autotable access uses local typed helpers instead of broad `any`. | `npm run typecheck` once available; targeted PDF export tests or manual PDF generation. | P0-01 if generated types are involved. |
| P1-02 | Top `as any` clusters | Replace the highest-count `as any` clusters with domain types or narrowing helpers. Start with wallboard panels, `useGlobalTaskMutations`, job details, optimized matrix, auth, Flex URL utilities, and tour rates. | The total `as any` count drops by at least 35% without changing runtime behavior. Remaining casts are justified with local comments or tracked follow-ups. | `rg "\\bas\\s+any\\b" src`; `npm run lint`; `npm run typecheck`. | P0-01. |
| P1-03 | Dynamic Supabase wrappers | Type dynamic table/RPC access used by task completion, global task mutations, Flex folders, and staffing helpers. | Dynamic table names are narrowed to explicit unions or wrapped behind typed service functions. Deep type instantiation errors are removed. | `npm run typecheck`; service unit tests for task completion and global tasks. | P0-01. |
| P1-04 | Festival gear JSON mappers | Normalize JSON database rows into typed festival gear models through one mapping layer. | Components do not cast raw Supabase `Json` values directly to `FestivalGearSetup`, `StageGearSetup`, or artist form models. | Festival artist form tests; public artist form smoke test; `npm run typecheck`. | P0-01. |
| P1-05 | TypeScript config path | After no-emit is clean, ratchet strictness in small steps: first `noImplicitAny`, then `strictNullChecks`, then broader `strict`. | Each ratchet lands with no new suppressions and an updated validation note. | `npm run typecheck`; `npm run test:critical`. | P0-02 and Phase 1 cleanup progress. |

## Phase 2: Data Layer Consistency

**Status:** Complete as of 2026-05-16. The pass established the shared `src/services/dataLayerClient.ts` boundary for legacy component/page query ownership, moved high-level wallboard and festival-management code into `src/features`, moved tour/user hooks toward `src/hooks`, centralized generic query-key creation in `src/lib/react-query.ts`, introduced reusable mutation feedback, and added Madrid timezone utilities/tests for wallboard-sensitive dates. No database migrations were introduced.

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P2-01 | Component/page data access | Move direct Supabase calls out of route and UI components into hooks or services, prioritizing files with many direct calls. | Components/pages no longer own query construction except for trivial auth/session reads. Initial target: reduce component/page direct Supabase hits by 50%. | Static scan for `supabase.(from\|rpc\|storage\|functions\|auth)` in `src/components` and `src/pages`; affected page tests. | P1-03 for shared wrappers. |
| P2-02 | Query keys | Replace inline `queryKey: [...]` usage with centralized key factories in `src/lib/react-query.ts` or feature-local key modules. | Query invalidation uses stable keys; inline query-key hits are reduced by at least 60%. | Static scan for `queryKey\\s*:\\s*\\[`; focused regression tests for invalidation-heavy flows. | None. |
| P2-03 | Mutation/toast boilerplate | Introduce shared mutation helpers for success/error toast and invalidation patterns. Standardize the preferred toast API. | Repeated dialog mutation boilerplate is removed from the highest-use flows; toast behavior remains consistent. | `npm run lint`; manual mutation smoke tests for edited flows. | Agreement on preferred toast API. |
| P2-04 | Permissions | Centralize repeated role checks behind `src/utils/permissions.ts` and a `usePermissions` hook. | Active app inline admin/management checks are removed or converted to named predicates/constants, and permission behavior is covered by unit tests. | Static scan for repeated role predicates; permission unit tests. | None. |
| P2-05 | Date/timezone handling | Audit `new Date(` usage and route domain-sensitive date operations through timezone-aware utilities. | Scheduling, payroll, wallboard, and PDF export dates are explicit about local date versus instant semantics. | Date utility tests around Europe/Madrid DST boundaries; affected workflow tests. | None. |

## Phase 3: Monolith Refactors

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P3-01 | Technician details | Split `src/components/technician/DetailsModal.tsx` into data hook, document helpers, tabs/sections, and a thin modal shell. | Main file is under 500 LOC; behavior and mobile layout are unchanged. | Existing technician tests; browser smoke on technician job detail modal. | Phase 2 data-layer patterns preferred. |
| P3-02 | Job card actions | Break `src/components/jobs/cards/JobCardActions.tsx` into action groups and service hooks. | Main file is under 500 LOC; WhatsApp, Flex, calculators, logistics, and document actions still work. | Job card tests; project management smoke test. | P2-01 and P2-03. |
| P3-03 | Flex folders | Split `src/utils/flex-folders/folders.ts` by operation: URL/building, creation, sync/status, deletion, and shared types. | Each module has one responsibility and current tests still pass. | Flex folder unit tests; targeted staging dry run for folder creation if available. | P1-03. |
| P3-04 | Consumos/Pesos tools | Consolidate duplicated sound/lights/video technical tool logic into shared hooks/views while preserving department-specific labels and exports. | Department pages share core calculations and persistence paths; user-facing PDFs remain equivalent. | Tool unit tests; manual PDF export comparison. | P2-05 for date handling. |
| P3-05 | Festival management VM | Split `src/pages/festival-management/useFestivalManagementVm.ts` into query hooks, command services, derived selectors, and view-model composition. | VM file is under 500 LOC and no command mixes unrelated side effects. | Festival management tests; public artist form smoke test. | P1-04 and P2-01. |
| P3-06 | Assignment matrix | Separate matrix data loading, virtualized view state, staffing actions, conflict handling, and cell rendering. | Large matrix files stay below 700 LOC each and preserve scroll/selection behavior. | Matrix unit tests; Playwright smoke for large technician lists. | P2-01 and P2-02. |
| P3-07 | Push broadcast | Keep the single event router model but group helpers by event family and add section-level tests. | `supabase/functions/push/broadcast.ts` remains easy to search while reducing helper clutter in the main function. | Edge function tests for representative event families. | None. |
| P3-08 | PDF exporters | Extract shared PDF setup, logo loading, header/footer, table-final-Y access, and file return helpers. | PDF exporters reuse common infrastructure and duplicate setup code is substantially reduced. | PDF export tests or manual render checks for affected documents. | P1-01. |

## Phase 4: Performance and Mobile PWA Optimization

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P4-01 | Measurement baseline | Capture bundle, Lighthouse, React Profiler, and key route timing baselines before optimizations. | Baseline metrics are committed to docs and can be compared after each performance PR. | `npm run build`; Lighthouse on production-like preview; profiler captures. | None. |
| P4-02 | Bundle splitting | Lazy-load heavy dialogs, PDFs, maps, and admin-only tools behind route or interaction boundaries. | Initial JS for core dashboards decreases measurably without breaking navigation. | Bundle analyzer output; route smoke tests. | P4-01. |
| P4-03 | Image strategy | Convert oversized PNG/JPEG assets used in first-run or marketing surfaces to WebP/AVIF where appropriate and add lazy/responsive loading. | Key image payloads shrink while visible quality remains acceptable. | Build output review; browser visual check on affected pages. | P4-01. |
| P4-04 | Realtime subscriptions | Audit subscription lifecycles and remove duplicate or stale channel wiring. | Subscription count is bounded per route, and route changes do not leave stale channels. | Subscription debug logs; route navigation smoke tests. | P2-01. |
| P4-05 | Mobile workflows | Verify technician app, dashboard, matrix, festival artist forms, and wallboard on mobile widths after refactors. | No text overlap, broken controls, or blocked primary actions on mobile. | Playwright mobile screenshots and targeted manual QA. | Relevant Phase 3 refactors. |

## Phase 5: Supabase Functions and Ops Cleanup

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P5-01 | Edge Function shared helpers | Extract common request parsing, CORS, auth, JSON responses, and error serialization into shared modules. | New and refactored functions use one response/error pattern. | `npm run lint:functions`; function unit tests. | None. |
| P5-02 | Email/push duplication | Consolidate repeated email template and push broadcast helpers across Edge Functions. | Shared helpers cover common message layout, recipient validation, and error logging. | Function tests for send paths; staging invocation. | P5-01. |
| P5-03 | Migration/RLS audit | Compare generated types, migrations, and production schema for drift. | Any untracked DB object has a migration or a documented exception. RLS assumptions are documented for new shared services. | Supabase schema diff; production `db push --dry-run` when needed. | Supabase access. |
| P5-04 | Security audit coverage | Extend persistent audit logging to additional sensitive operations such as role changes, credential-like access, user management, and bulk data export. | Critical administrative actions produce durable audit rows without logging secrets. | Security audit tests; admin workflow smoke tests. | Existing security audit function. |

## Phase 6: Legacy and Documentation Cleanup

| ID | Affected area | Concrete task | Acceptance criteria | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P6-01 | `src/legacy` | Decide whether each legacy file is still reachable, then remove, migrate, or document it. | No dead legacy route or component remains without an owner and removal plan. | Route search; build; targeted smoke tests if migrated. | Product owner confirmation for legacy workflows. |
| P6-02 | Commented/dead code | Remove commented-out code blocks, obsolete re-exports, and unused exports once verified. | Dead code scans are clean or documented with rationale. | `rg` scans; `npm run lint`; focused tests. | None. |
| P6-03 | TODO closure | Convert TODO/FIXME/HACK items into tracked issues or complete them. | Source TODOs are either resolved or reference a durable issue/task ID. | `rg -n "TODO\|FIXME\|HACK\|XXX" src supabase`. | Team issue tracker or roadmap task IDs. |
| P6-04 | Architecture docs | Keep `ARCHITECTURE.md`, `docs/README.md`, and subsystem workflow docs aligned with the refactored code. | Major subsystem boundaries in docs match actual source layout and current validation commands. | Documentation review in each large refactor PR. | Phase 3 and Phase 5 changes. |

## Ongoing Quality Gates

- Every maintenance PR should state which roadmap task IDs it advances.
- Prefer small PRs that reduce one metric or one monolith at a time.
- Do not combine cleanup with behavior changes unless the behavior change is required to make the cleanup safe.
- For broad/shared UI or data changes, run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
- For Supabase function changes, also run:
  - `npm run lint:functions`
- For mobile runtime changes, also run:
  - `npm run cap:sync`
- Type checking is part of the standard local and CI validation path as of P0-02.
