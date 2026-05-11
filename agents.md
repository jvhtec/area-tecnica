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
   - Work from `dev` unless explicitly instructed otherwise.
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

5. **Documentation**
   - Always update documentation at the end of each turn.
   - Always update changelog.md at the end of each session.

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

## Operational Notes

- Keep Cloudflare build compatibility:
  - Install: `npm install --legacy-peer-deps`
  - Build: `npm run build`
- Do not change build pipeline assumptions unless task explicitly requires it.
- If architecture/docs diverge from code, align new work with actual code and update docs.
