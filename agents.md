# Area Tecnica - Technical Management System

## Stack
React 18 + TypeScript, Vite 6, Supabase, Tailwind + shadcn/ui, React Query

## Critical Rules
- **Work on `dev` branch only. Never touch `main`.**
- Use `npm install --legacy-peer-deps` always
- Never add lovable-tagger or Lovable packages
- Maintain database compatibility with existing Supabase schema

## Project Structure
```
src/
├── components/     # UI components (inventory, wireless configs)
├── integrations/   # Supabase client
├── types/          # TypeScript definitions
└── pages/         # Routes
```

## Current Features
- Microphone inventory management
- Wireless system configuration
- Equipment tracking with database-driven dropdowns
- Job assignment matrix

## Environment
```bash
npm run dev              # localhost:8080
VITE_SUPABASE_URL        # In Cloudflare
VITE_SUPABASE_ANON_KEY   # In Cloudflare
```

## Deploy
Push to `dev` → preview URL  
Merge to `main` → sector-pro.work

## Patterns
- Use @ imports: `@/components/...`
- Supabase client: `@/integrations/supabase/client`
- shadcn/ui for new components
- React Query for data fetching
- date-fns for dates (v3.6.0)

## Workflow
```bash
git checkout dev
# make changes
git commit -m "feat: description"
git push origin dev
# Create PR → merge to main when approved
```

## Database
Supabase backend. Preserve existing schema when adding features.
Local Supabase CLI: TODO setup with `supabase start`

## Build Flags & Gotchas

### npm Install
**Always use:** `npm install --legacy-peer-deps`
- Required due to peer dependency conflicts (vite 6, date-fns 3, vitest)
- No package-lock.json in repo (intentional - prevents Cloudflare npm ci issues)

### Dependency Constraints
- date-fns: **Must stay at ^3.6.0** (react-day-picker compatibility)
- vite: ^6.3.3 (vitest has peer conflicts - ignore warnings)
- Never upgrade these without testing build

### Cloudflare Build
Build command in Cloudflare Pages:
```
npm install --legacy-peer-deps && npm run build
```
Output: `dist/`
**Do not** change build command or add package-lock.json to repo

### vite.config.ts
- No lovable-tagger imports
- base: '/' (required for asset paths)
- componentTagger removed from plugins

### Common Build Failures
- "ERESOLVE unable to resolve" → forgot --legacy-peer-deps
- "MIME type text/html" → clear Cloudflare cache, retry deploy
- "Cannot find lovable-tagger" → check vite.config.ts imports
- package-lock sync errors → delete package-lock.json from repo

### Local Dev
If dependencies get corrupted:
```bash
sudo rm -rf node_modules
npm install --legacy-peer-deps
```
```

---

**And for .cursorrules:**
```
# Area Tecnica - Audio/Video Equipment Management

Work on `dev` branch. Never commit to `main`.
Stack: React+TS, Vite, Supabase, Tailwind+shadcn
Install: `npm install --legacy-peer-deps`
Import: Use @ alias (`@/components/...`)
Deploy: Push dev → preview, merge main → sector-pro.work

Current focus: Microphone inventory, wireless configs, database-driven UI
Maintain existing Supabase schema compatibility.

## Build Warnings
- Always: `npm install --legacy-peer-deps`
- No package-lock.json in repo (intentional)
- date-fns locked at v3.6.0 (don't upgrade)
- vite.config.ts: no lovable-tagger imports
- Cloudflare build: npm install --legacy-peer-deps && npm run build