# Area Tecnica

**Production URL:** https://sector-pro.work

Area Tecnica is Sector Pro’s technical operations platform for live events, festivals, tours, logistics, and crew workflows. It ships as a PWA and a Capacitor-wrapped iOS/Android app.

## Release Notes
- Latest changes are tracked in `CHANGELOG.md` (append-only).
- For deployment notes, tag the PR with the release date and include the preview URL.

## Stack
- React 18 + TypeScript
- Vite 6
- Tailwind + shadcn/ui
- React Query
- Supabase (Auth, DB, Storage, Edge Functions)
- Capacitor (iOS/Android wrapper)

## Project Structure
```
src/
├── components/     # UI components (inventory, wireless configs)
├── integrations/   # Supabase client
├── types/          # TypeScript definitions
└── pages/          # Routes
```

## Local Development
```bash
npm install --legacy-peer-deps
npm run dev
```
- Dev server: http://localhost:8080
- Env vars (Cloudflare):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_VAPID_PUBLIC_KEY` (web push)

## Mobile (Capacitor)
```bash
npm run cap:ios
npm run cap:android
```

## Push Notifications
- **Web/PWA:** uses Service Worker + VAPID keys.
- **iOS (Capacitor):** uses APNs with device tokens stored server-side.
  - Required Supabase Edge Function secrets:
    - `APNS_AUTH_KEY` (APNs .p8 contents)
    - `APNS_KEY_ID`
    - `APNS_TEAM_ID`
    - `APNS_BUNDLE_ID`
    - `APNS_ENV` (`sandbox` or `production`)
  - Without APNs configured, iOS native push is skipped.

## Screenshots
### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Festival Management
![Festival Management](docs/screenshots/festival-management.png)

### Tour Management
![Tour Management](docs/screenshots/tour-management.png)

### Day Sheet
![Day Sheet](docs/screenshots/day-sheet.png)

### Freelancer Portal
![Freelancer Portal](docs/screenshots/freelancer-portal.png)

### Crew Assignment Matrix
![Crew Assignment Matrix](docs/screenshots/crew-assignment-matrix.png)

### Technical Tools
![Technical Tools](docs/screenshots/technical-tools.png)

### Digital Signage
![Digital Signage](docs/screenshots/digital-signage.png)

## Build & Deploy (Cloudflare Pages)
```bash
npm install --legacy-peer-deps && npm run build
```
- Output: `dist/`
- `vite.config.ts` base must remain `/`
- Do not add `package-lock.json` to the repo

## Workflow
```bash
git checkout dev
# make changes
git commit -m "feat: description"
git push origin dev
# Create PR → merge to main when approved
```

## Notes
- Maintain compatibility with the existing Supabase schema.
- date-fns must remain at `^3.6.0`.
- Vite is pinned to `^6.3.3`.
