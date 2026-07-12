# AGENTS.md — Area Tecnica (Sector Pro)

This file provides working guidance for coding agents operating in this repository.

Two companion documents in `docs/agents/` apply to every agent regardless of harness:

- `docs/agents/operating-manual.md` — the working method expected here: how to read requests, decompose and verify work, label known vs. guessed, and communicate results. Read it once in full; run its five-question self-test on every answer.
- `docs/agents/pr-workflow.md` — the standard PR workflow: agent authority boundary (prepare + shepherd; humans merge), high-risk classification, CodeRabbit protocol, quality bar, and pre-handoff self-check.

## Project identity

- Product: Area Tecnica (Sector Pro)
- Type: Mobile-first PWA for live-event technical operations
- Primary stack: React 18 + TypeScript + Vite 6 + Supabase + Tailwind + shadcn/ui + TanStack Query + Zustand
- Deployment:
  - `main` → production (`sector-pro.work`)
  - Any other branch/PR → automatic Cloudflare Pages preview deployment (`https://<commit-hash>.area-tecnica.pages.dev`)

## Non-negotiable rules

1. Branch discipline
   - There is no `dev` integration branch. Always branch from current remote `main`:
     ```bash
     git fetch origin main
     git switch -c codex/<short-description> origin/main
     ```
   - Never commit directly to `main`.
   - Keep the branch rebased on `main` before opening/updating a PR (`git fetch origin main && git rebase origin/main`).

2. Dependency install
   - CI and clean local verification use:
     ```bash
     npm ci --legacy-peer-deps
     ```
   - When intentionally updating dependencies, run:
     ```bash
     npm install --legacy-peer-deps
     ```
     and commit both `package.json` and `package-lock.json`.

3. Build/dependency constraints
   - Keep `date-fns` at `^3.6.0` unless a planned migration is approved.
   - Keep Vite major version aligned with the current config/build pipeline.
   - Do not add or re-introduce `lovable-tagger`.
   - Do not remove the deterministic `package-lock.json` policy without an approved dependency migration.

4. Supabase compatibility
   - Preserve compatibility with existing schema and RLS behavior.
   - Prefer additive, backward-compatible database changes.
   - Add or update database authorization tests under `supabase/tests/database` for RLS/RPC-sensitive changes.

## Source-of-truth architecture

Follow the repository architecture documented in `ARCHITECTURE.md`.

### Top-level areas

- `src/components/` — feature/domain UI (festival, tours, jobs, matrix, equipment, logistics, messages, timesheet, sound, lights, video, etc.)
- `src/pages/` — route-level, lazy-loaded pages
- `src/features/` — co-located feature logic modules (activity, staffing, timesheets, rates, festival-management, lights, tour-ops, wallboard, technical-tools)
- `src/hooks/` — reusable and feature hooks (including auth/push)
- `src/lib/` — core platform libraries (query config, Supabase wrappers, push, shortcuts, streamdeck, flex)
- `src/stores/` — Zustand global state
- `src/integrations/supabase/` — Supabase client + generated DB types
- `src/utils/` — domain utilities (PDF, weather, role routing, hoja de ruta, flex folders, etc.)
- `supabase/` — migrations, seed, Edge Functions, and database tests
- `tests/` — integration/e2e coverage

## Architectural patterns to preserve

- Auth/role flow centered around optimized auth hooks/providers and role-based routing.
- Data layer uses TanStack Query for server state; avoid ad-hoc fetch state where query patterns exist.
- Global UI/app state belongs in existing Zustand stores when cross-component/global.
- Realtime should use centralized connection/subscription abstractions instead of one-off channel wiring.
- Feature organization should remain domain-based with co-located types/hooks/utils when practical.

## Coding and change guidelines

- Use `@/` imports instead of deep relative paths when possible.
- Reuse established shadcn/ui primitives from `src/components/ui/`.
- Keep components focused; extract hooks/utilities rather than growing monolith files.
- Preserve lazy-loading boundaries in routes/pages.
- Respect existing TypeScript typing patterns; avoid `any` unless justified.
- Keep changes minimal, targeted, and consistent with adjacent code.

## Validation checklist before commit

Run relevant checks for touched areas:

```bash
npm run lint
npm run test:run
npm run build
```

For broad or high-risk changes, also run:

```bash
npm run typecheck
npm run governance
npm run test:critical
npm run test:e2e
```

If changes affect Supabase functions, also run:

```bash
npm run lint:functions
```

If changes affect database migrations or authorization behavior, also run:

```bash
npm run ci:db:migrations
supabase db reset --local --no-seed
supabase db lint --local --fail-on error --schema public,auth
supabase test db supabase/tests/database
```

If changes affect mobile runtime behavior, ensure Capacitor sync path remains valid:

```bash
npm run cap:sync
```

`npm run governance` chains 7 sub-gates (`governance:source`, `:filesize`, `:functions`, `:exposure`, `:sql-grants`, `:actions`, plus `ci:db:migrations` and `audit:deps`) — run it directly if you only need to debug one gate, e.g. `npm run governance:exposure` for Edge Function JWT/exposure classification drift.

## Production PR workflow

Use this workflow for production-bound work unless the user explicitly requests a different release path:

1. Start from the current remote `main` on a new branch:
   ```bash
   git fetch origin main
   git switch -c codex/<short-description> origin/main
   ```
2. Keep the change focused. Do not cherry-pick broad historical PRs when only a subset of behavior is needed; backport the intended behavior onto current `main`.
3. Run the relevant local validation from the checklist above. For broad or shared UI/data changes, prefer:
   ```bash
   npm run lint
   npm run typecheck
   npm run governance
   npm run test:critical
   npm run test:run
   npm run build
   npm run budget:bundle
   ```
4. Commit, push the branch, and open a PR to `main`.
5. Wait for all GitHub CI checks and CodeRabbit to finish. Inspect CodeRabbit summary, inline comments, and pre-merge checks. CI spans three workflows: `.github/workflows/tests.yml` (11 jobs: lint, typecheck, governance, test_critical, test_run, build, e2e_smoke, migration_ordering, migration_apply, db_lint, rls_rpc_security_tests), `.github/workflows/codeql.yml` (CodeQL analysis), and `.github/workflows/security.yml` (dependency review + SBOM generation) — all must be green.
6. Address every actionable CI or CodeRabbit issue with follow-up commits, rerun relevant local validation, push, and wait again until clean.
7. Before merge:
   - If the PR includes Supabase migrations, flag in the PR description that a production `supabase db push --linked --dry-run` and migration apply are required — these production steps are run by a human, not by an agent.
   - If the PR has no database migration, no Supabase production push is required; merging `main` is the production deploy path.
8. Agents stop at *mergeable*: all CI green, CodeRabbit and review threads resolved, branch current with `main`. Report that state and hand off — **the final merge is always performed by a human.** Do not merge or approve PRs yourself.

For the full production release checklist, use `docs/release/production-release-checklist.md`. For the agent-facing workflow detail (authority boundary, high-risk classification, CodeRabbit protocol, quality bar), use `docs/agents/pr-workflow.md`.

## Operational notes

- Keep Cloudflare build compatibility:
  - Install: `npm ci --legacy-peer-deps`
  - Build: `npm run build`
- Do not change build pipeline assumptions unless the task explicitly requires it.
- If architecture/docs diverge from code, align new work with actual code and update docs.
- `docs/README.md` is a partial index — it covers curated workflow/architecture docs but not the many one-off audit/fix/summary docs at the root of `docs/` or newer subfolders (`staffing/`, `operations/`, `performance/`, `release/`, `data_audit_phase0/`). If a topic isn't in the index, search `docs/` directly before concluding it isn't documented.
- Repo-wide counts drift fast in this codebase (170+ Supabase migrations, 67 Edge Functions, 150+ hooks as of this writing) — don't trust a stale number from a doc; verify with `ls`/`wc -l` when a count matters for a decision.
