# Sector Pro – Codebase Analysis (2025-09-22)

This document captures a point‑in‑time analysis of the repository at `/home/javi/area-tecnica`. It summarizes the stack, structure, dependencies, tooling, notable findings, and recommended next steps.

## Overview

- App type: Vite + React + TypeScript single‑page app with Tailwind and shadcn‑ui
- Backend/services: Supabase (auth, DB, storage, edge functions), local helper `supabase-server` folder
- Domain focus: Event/project management (tours, festivals, logistics, staffing, timesheets)
- Entry points: `index.html` loads `/src/main.tsx`; routing and pages under `src/pages`
- Env: Frontend uses `VITE_*` env vars (present in `.env`), plus code-based config in `src/lib/api-config.ts`

## Project Structure (top-level)

- Root: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.env` (local), `public/`, `src/`, `docs/`, `supabase/`, `supabase-server/`
- Frontend: `src/` organized by domain: `components/`, `hooks/`, `lib/`, `pages/`, `utils/`, `features/`, `integrations/`
- Supabase:
  - `supabase/migrations/` – SQL migrations
  - `supabase/functions/` – Deno edge functions (PDF generation, emails, maps, staffing, etc.)
- Server helper: `supabase-server/src/api/…` (small TS utilities using supabase-js)
- Docs: `docs/modernization-plan.md`, `docs/hoja-de-ruta-*.md`
- Memory: `memory-bank/*.md` (project/product/system/tech context)

### Directory snapshots (max depth 2)

- `src` subdirs: calc, components (ui, festival, logistics, jobs, tours, …), hooks (incl. hoja-de-ruta, festival), lib, pages, utils, features (lights, staffing, timesheets, activity), integrations/supabase
- `supabase` subdirs: functions (generate-*/apply-flex-status/send-password-reset/…), migrations

## Languages & Size

- Files: 881 (excluding `.git`)
- LOC by extension (approx):
  - TSX: 79,667
  - TS: 45,812
  - JSON: 11,694
  - SQL: 7,400
  - MD: 981
  - HTML: 785
  - CSS: 253

## Tooling

- Build: Vite (`vite.config.ts`) with `@vitejs/plugin-react-swc` and alias `@ → ./src`
- UI: Tailwind (`tailwind.config.ts`) + shadcn‑ui
- Lint: ESLint 9 (`eslint.config.js`) with TS + React Hooks; `@typescript-eslint/no-unused-vars` is disabled
- TypeScript: `tsconfig.app.json` (non‑strict; noUnused* disabled), `tsconfig.node.json` (strict true)
- Scripts (`package.json`): `dev`, `build`, `build:dev`, `lint`, `preview`
- Locks: `package-lock.json` (root), `bun.lockb`

## Dependencies (selected)

- Core: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`
- Supabase: `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-ui-*`
- UI: `tailwindcss`, `lucide-react`, `radix-ui` packages, `sonner`
- PDF/Docs: `pdf-lib`, `jspdf`, `exceljs`, `xlsx`, `react-markdown`
- Misc: `zod`, `zustand`, `qrcode`

See `package.json` for the full list.

## Notable Files

- Vite config: `vite.config.ts`
- Tailwind config: `tailwind.config.ts`
- ESLint config: `eslint.config.js`
- SPA entry: `index.html`
- Env (local): `.env` (contains `VITE_SUPABASE_*` values; do not commit)
- Supabase client: `src/lib/supabase-client.ts`, re-exported by `src/lib/supabase.ts`
- API config (hardcoded URL/key; see “Security”): `src/lib/api-config.ts`
- Realtime/subscription utils: `src/lib/{optimized-*,*subscription*}.ts`
- PDF generation (Edge): `supabase/functions/generate-memoria-tecnica/index.ts`

## Tests & CI/CD

- Tests: none found (no `*.test.tsx?` or Vitest config). Docs outline adding Vitest/RTL.
- CI: no GitHub Actions or other CI workflows detected.

## Security & Secrets

- Hardcoded Supabase URL/key in `src/lib/api-config.ts:2-3` (anon key printed in code). Prefer env‑driven config (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `.env` exists with `VITE_SUPABASE_*` values for local dev and is gitignored.
- External script loaded in `index.html:19` – `https://cdn.gpteng.co/gptengineer.js`. Consider gating or removing in production builds.
- Security helpers exist: `src/lib/security-config.ts`, `src/lib/enhanced-security-config.ts`, `src/lib/security-audit.ts` (audit log TODO).
- One usage of `dangerouslySetInnerHTML` in `src/components/ui/chart.tsx:79` for CSS variable injection.

## Supabase

- Migrations: extensive under `supabase/migrations/`
- Edge functions: PDFs, static maps, email/password workflows, Flex API helpers, etc.
- Typical function style uses Deno `serve`, `pdf-lib`, and Supabase REST (service role) with CORS headers.

## TODOs/FIXMEs (sample)

- `src/lib/security-audit.ts` – implement secure audit log storage
- `src/data/trussModels.ts` – replace placeholder truss values with manufacturer data

Run `rg -n "TODO|FIXME|HACK|XXX"` for the full list.

## Quick Health Observations

- TypeScript strictness: app config is intentionally loose (noUnused*, noImplicitAny false). Tightening planned in docs.
- Lint: modern ESLint in place; one rule disabled to reduce noise.
- Bundle: large TSX codebase; consider route‑based code splitting (see docs) to reduce initial JS.
- External script: review/gate `gptengineer.js` for production.
- Secrets: move Supabase URL/anon key to `VITE_*` envs and avoid in source.
- Tests/CI: missing; add Vitest + GitHub Actions as per docs.

## Recommended Next Steps

1) Security & Config
- Replace hardcoded Supabase config with `import.meta.env.VITE_SUPABASE_URL/ANON_KEY` and add `.env.example`.
- Gate or remove external script in `index.html` via `VITE_ENABLE_GPTENG`.

2) Code Quality
- Re‑enable `@typescript-eslint/no-unused-vars` (warn) and gradually tighten TS flags (noUnused*, strictNullChecks).
- Introduce a small `logger` and remove noisy `console.*` in infra modules.

3) Performance
- Add route‑level `React.lazy` and `Suspense`; split heavy libs via Vite manual chunks.
- Prune or lazy‑gate large assets in `public/` (DOS game files, large images).

4) Reliability
- Add Vitest + React Testing Library; start with infra modules (`token-manager`, `unified-subscription-manager`).
- Add GitHub Actions: install, lint, typecheck, test, build with cache.

5) Documentation
- Add `docs/architecture.md` describing data flow (Supabase, React Query, realtime, multi‑tab coordination).
- Update README with env var usage and build/run notes.

## Commands (local dev)

- Install: `npm i`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build` or `npm run build:dev`
- Preview: `npm run preview`

## Appendix – References

- SPA entry: `index.html:19`
- Supabase env vars in repo: `.env:1-3` (values present locally; keep out of git)
- Hardcoded Supabase config: `src/lib/api-config.ts:2-3`
- Supabase client: `src/lib/supabase-client.ts:1`
- ESLint config: `eslint.config.js:1`
- Vite config: `vite.config.ts:1`
- Tailwind config: `tailwind.config.ts:1`
- Chart style injection: `src/components/ui/chart.tsx:79`

