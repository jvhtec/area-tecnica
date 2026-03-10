# Sector Pro Modernization Plan

Goals: Keep full functionality, ship in small reversible steps, use env-driven config, and add guardrails (tests/CI) before high‑impact refactors.

## Phase 1 — Security & Config

- Secrets to env vars
  - Replace hardcoded Supabase config in `src/lib/api-config.ts` with `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - Add `.env.example` with placeholders; ensure `.env` is gitignored and not committed.
- Third‑party script hardening
  - Remove or gate `index.html` script `https://cdn.gpteng.co/gptengineer.js` behind `VITE_ENABLE_GPTENG` and only enable in development.
  - Document CSP guidance and Subresource Integrity (SRI) if any remote scripts remain.
- Acceptance criteria
  - App runs with `VITE_*` vars; no hardcoded keys; no production secrets in Git.

## Phase 2 — Routing & Code Splitting

- Route‑based code splitting
  - Convert page imports in `src/App.tsx` to `React.lazy(() => import('…'))` with `Suspense` fallbacks.
  - Add a shared `ErrorBoundary` for route chunks.
- Remove router duplication
  - Either delete `src/routes/index.tsx` or adopt it as the single source; avoid divergence with `App.tsx`.
- Acceptance criteria
  - Initial bundle size reduced; navigation works with lazy‑loaded routes; unused router removed.

## Phase 3 — TypeScript & Lint Tightening (Incremental)

- Stage 1
  - Enable `noUnusedLocals`, `noUnusedParameters` as warnings; keep `skipLibCheck` temporarily.
  - Re‑enable ESLint `@typescript-eslint/no-unused-vars` as `warn`.
- Stage 2
  - Enable `strictNullChecks`, `noImplicitAny` in `tsconfig.app.json`; fix surfaced issues module‑by‑module (start with `src/lib/*`).
- Stage 3
  - Enable `strict: true`; narrow `allowJs`; keep only where necessary.
- Acceptance criteria
  - Clean builds; reduction of `any` usage; warnings trending down.

## Phase 4 — Logging Hygiene

- Introduce `src/lib/logger.ts` with leveled logging and env‑based thresholds.
- Replace `console.*` usage in infra code (`useAuth`, `token-manager`, `unified-subscription-manager`, `multitab-coordinator`, providers) with logger.
- Disable debug logs in production; keep warnings/errors.
- Acceptance criteria
  - Quiet production console with togglable debug in dev.

## Phase 5 — Realtime & Session Tuning

- Intervals consolidation
  - Ensure heavy tasks (invalidations/heartbeats) run only in leader tab via `MultiTabCoordinator` (audit for gaps).
  - Tune intervals (e.g., heartbeat 5–10s; connection checks 30–60s) without harming UX.
- Cleanup audits
  - Verify every `setInterval/setTimeout` and channel has cleanup on unmount/destroy in `SubscriptionProvider` and managers.
- Recovery
  - Keep `forceRefreshSubscriptions` and `supabase-reconnect` flows; add backoff to avoid thundering herds.
- Acceptance criteria
  - No memory leaks; CPU‑friendly background behavior; robust reconnection.

## Phase 6 — Bundle & Assets

- Assets pruning
  - Move large, non‑essential assets out of default `public/` path or load behind lazy routes (e.g., DOS game files).
- Vendor chunking
  - Expand manual chunks in `vite.config.ts` for heavy libs (`pdf-lib`, `exceljs`, devtools) when not needed at startup.
- Acceptance criteria
  - Reduced initial JS size; route‑specific assets fetched on demand.

## Phase 7 — Testing Foundation

- Tooling
  - Add Vitest + React Testing Library; configure `package.json` scripts and `vitest.config.ts`.
- Initial coverage
  - Unit tests: `src/lib/token-manager.ts`, `src/lib/unified-subscription-manager.ts`, `src/lib/multitab-coordinator.ts` (happy paths and basic errors).
  - Component smoke: `src/components/AppInit.tsx`, `src/components/layout/Layout.tsx` with mocked providers.
- Acceptance criteria
  - Tests green in CI; baseline coverage on critical infra.

## Phase 8 — CI & Quality Gates

- GitHub Actions workflow
  - Jobs: install, lint, typecheck, test, build with caching.
- Optional pre‑commit hooks
  - Husky + lint‑staged to run format/lint on changed files.
- Acceptance criteria
  - PRs must pass lint/test/build before merge.

## Phase 9 — Observability & Errors

- Error Boundaries
  - Global boundary around router; local boundaries for heavy pages/tools.
- Optional Sentry (or similar)
  - Env‑gated setup; PII‑scrubbed; conservative sample rate.
- Acceptance criteria
  - Friendly fallbacks for uncaught errors; maintainers can observe failures.

## Phase 10 — Documentation & Rollout

- Docs
  - Update `README.md` with env var usage, dev instructions, and notes on gated dev scripts.
  - Add `docs/architecture.md` describing data flow (Supabase, React Query, Subscriptions, Multi‑tab coordination).
- Rollout
  - Feature‑flag sensitive refactors (logging, lazy‑load toggles).
  - Canary release; monitor; rollback via flags or previous build.
- Acceptance criteria
  - Clear local setup; changes reversible without downtime.

---

## Task Checklist (by file/folder)

- `src/lib/api-config.ts`
  - Switch to `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `.env`
  - Add `.env.example`; ensure `.env` is gitignored; remove committed secrets.
- `index.html`
  - Remove/gate external script; add CSP/SRI notes.
- `src/App.tsx`
  - Lazy‑load page routes with `React.lazy` + `Suspense`; add route error boundary.
- `src/routes/index.tsx`
  - Remove or adopt as single router; avoid duplication with `App.tsx`.
- `tsconfig*.json`
  - Stage stricter flags as described; address issues iteratively.
- `eslint.config.js`
  - Re‑enable `@typescript-eslint/no-unused-vars`; consider import/order rules.
- `src/lib/logger.ts`
  - Introduce leveled logger; replace `console.*` in infra.
- `src/lib/*`
  - Audit intervals/cleanup; leader‑only heavy work; add backoff where needed.
- `vite.config.ts`
  - Consider expanded `manualChunks`; keep sourcemaps in dev only.
- `public/`
  - Prune large unused assets or lazy‑gate them.
- `tests/`
  - Add Vitest/RTL config + initial unit and smoke tests.
- `.github/workflows/ci.yml`
  - Lint, typecheck, test, build pipeline with cache.
- `docs/`
  - Add `architecture.md`; update `README.md` with env details.

## Risks & Rollback

- All changes are incremental and flag‑gated; rollback through flags or previous build.
- No database schema changes; runtime‑only improvements.
- Tests/CI reduce regression risk before enabling stricter TS/ESLint.

## Sequencing & Ownership

1. Phase 1 (security/config) – high priority.
2. Phase 2 (routing/codesplit) – immediate perf gains.
3. Phase 3 (TS/ESLint) – staged over multiple PRs.
4. Phases 4–6 (logging, realtime/session tuning, bundle) – parallelizable.
5. Phases 7–8 (tests/CI) – baseline guardrails.
6. Phases 9–10 (observability/docs) – polish and maintainability.

## Tracking & Metrics

- Bundle size (kb) before/after.
- Time‑to‑interactive for dashboard route.
- Error rate and reconnect success after realtime tuning.
- Lint/type error counts trend.
- Test coverage for infra modules.

