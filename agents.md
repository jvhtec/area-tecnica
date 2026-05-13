# AGENTS.md — Area Tecnica (Sector Pro)

This file provides working guidance for coding agents operating in this repository.

## Project Identity

- **Product**: Area Tecnica (Sector Pro)
- **Type**: Mobile-first PWA for live-event technical operations
- **Primary stack**: React 18 + TypeScript + Vite 6 + Supabase + Tailwind + shadcn/ui + TanStack Query + Zustand
- **Deployment**:
  - `main` → production (`sector-pro.work`)
  - `dev` → preview environments

## Non-Negotiable Rules

1. **Branch discipline**
   - Default to a new feature branch from the current remote `main`:
     ```bash
     git fetch origin main
     git switch -c codex/<short-description> origin/main
     ```
   - Work from `dev` only when explicitly requested for preview-environment work.
   - Never commit directly to `main`.

2. **Dependency install**
   - Always run:
     ```bash
     npm install --legacy-peer-deps
     ```
   - Do **not** add `package-lock.json`.

3. **Build/dependency constraints**
   - Keep `date-fns` at `^3.6.0` unless a planned migration is approved.
   - Keep Vite major version aligned with current config/build pipeline.
   - Do not add or re-introduce `lovable-tagger`.

4. **Supabase compatibility**
   - Preserve compatibility with existing schema and RLS behavior.
   - Prefer additive, backward-compatible database changes.

## Source-of-Truth Architecture

Follow the repository architecture documented in `ARCHITECTURE.md`.

### Top-level areas

- `src/components/` — feature/domain UI (festival, tours, jobs, matrix, equipment, logistics, messages, timesheet, sound, lights, video, etc.)
- `src/pages/` — route-level, lazy-loaded pages
- `src/features/` — co-located feature logic modules (activity, staffing, timesheets, rates, lights)
- `src/hooks/` — reusable and feature hooks (including auth/push)
- `src/lib/` — core platform libraries (query config, Supabase wrappers, push, shortcuts, streamdeck, flex)
- `src/stores/` — Zustand global state
- `src/integrations/supabase/` — Supabase client + generated DB types
- `src/utils/` — domain utilities (PDF, weather, role routing, hoja de ruta, flex folders, etc.)
- `supabase/` — migrations, seed, and Edge Functions
- `tests/` — integration/e2e coverage

### Architectural patterns to preserve

- **Auth/role flow** centered around optimized auth hooks/providers and role-based routing.
- **Data layer** uses TanStack Query for server state; avoid ad-hoc fetch state where query patterns exist.
- **Global UI/app state** belongs in existing Zustand stores when cross-component/global.
- **Realtime** should use centralized connection/subscription abstractions instead of one-off channel wiring.
- **Feature organization** should remain domain-based (festival/tours/jobs/etc.) with co-located types/hooks/utils when practical.

## Coding & Change Guidelines

- Use `@/` imports (configured alias) instead of deep relative paths when possible.
- Reuse established shadcn/ui primitives from `src/components/ui/`.
- Keep components focused; extract hooks/utilities rather than growing monolith files.
- Preserve lazy-loading boundaries in routes/pages.
- Respect existing TypeScript typing patterns; avoid `any` unless justified.
- Keep changes minimal, targeted, and consistent with adjacent code.

## Validation Checklist (Before Commit)

Run relevant checks for touched areas:

```bash
npm run lint
npm run test:run
npm run build
```

If changes affect Supabase functions, also run:

```bash
npm run lint:functions
```

If changes affect mobile runtime behavior, ensure Capacitor sync path remains valid:

```bash
npm run cap:sync
```

## Production PR Workflow

Use this workflow for production-bound work unless the user explicitly requests a different release path:

1. Start from the current remote `main` on a new branch:
   ```bash
   git fetch origin main
   git switch -c codex/<short-description> origin/main
   ```
2. Keep the change focused. Do not cherry-pick broad historical PRs when only a subset of behavior is needed; backport the intended behavior onto current `main`.
3. Run the relevant local validation from the checklist above. For broad or shared UI/data changes, prefer the full trio:
   ```bash
   npm run lint
   npm run test:run
   npm run build
   ```
4. Commit, push the branch, and open a PR to `main`.
5. Wait for all GitHub CI checks and CodeRabbit to finish. Inspect CodeRabbit summary, inline comments, and pre-merge checks.
6. Address every actionable CI or CodeRabbit issue with follow-up commits, rerun relevant local validation, push, and wait again until clean.
7. Before merging:
   - If the PR includes Supabase migrations, run a production `supabase db push --dry-run`, apply the pending migrations to the linked production project, and confirm a follow-up dry run reports the remote database is up to date.
   - If the PR has no database migration, no Supabase production push is required; merging `main` is the production deploy path.
8. Merge only after CI, CodeRabbit, and any required production migration/deploy steps are clean. Verify the PR is merged and the local worktree is clean.

## Operational Notes

- Keep Cloudflare build compatibility:
  - Install: `npm install --legacy-peer-deps`
  - Build: `npm run build`
- Do not change build pipeline assumptions unless task explicitly requires it.
- If architecture/docs diverge from code, align new work with actual code and update docs.
