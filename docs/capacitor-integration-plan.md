# Capacitor Integration Plan for Sector Pro React App

## 1. Current State Assessment
- **Framework & toolchain:** Vite + React 18 + TypeScript (`package.json`).
- **Routing & auth:** React Router DOM with extensive route tree guarded by `RequireAuth`; Supabase auth flows handled via providers/hooks (e.g., `OptimizedAuthProvider`, `SubscriptionProvider`).
- **Data layer:** TanStack Query with a shared `queryClient`; multi-tab coordination logic in `MultiTabCoordinator`.
- **Styling/UI:** Tailwind CSS + shadcn/Radix component library.
- **Assets & PWA files:** `public/manifest.json` already exists, but there is **no service worker implementation** or runtime caching for API/data (`rg` search for "service worker" returned nothing). Static assets served via Vite build into `build/` (configured by default).
- **Build scripts:** `npm run build` runs `vite build`; no mobile tooling present yet.

## 2. Project Goals
1. **Wrap the existing React PWA in Capacitor shells for both iOS and Android** without disrupting current web deployment.
2. **Enable robust offline support**: cache static assets, guard authenticated flows, and optionally cache key API payloads (Supabase + other HTTP endpoints).
3. **Implement push notifications on iOS and Android** using Capacitor Push Notifications with Firebase Cloud Messaging (FCM) as the cross-platform delivery bridge.
4. Maintain a single codebase that still builds/deploys as a standard web app.

### 2.1 Assumptions & Dependencies
- Apple Developer Program and Google Play Console accounts are already available for provisioning/signing.
- Firebase project will be shared across mobile apps and existing web usage (if any); access to create service accounts is granted.
- Supabase instance can be extended with new tables/functions (e.g., `push_devices`) and environment variables for native builds.
- Native platform directories (`ios/`, `android/`) are allowed in the monorepo; if not, confirm alternative hosting (e.g., Git submodules).
- Team has macOS and Windows/Linux workstations available for native builds; verify minimum OS versions and Xcode/Android Studio requirements.
- Confirm Node.js 18+ baseline across the team to align with Capacitor CLI expectations.

## 3. Proposed Work Streams
### A. Core Capacitor Setup
1. Add Capacitor dependencies and config (`capacitor.config.ts`) with `webDir` set to Vite's output (`dist/` or configured `build`).
2. Define npm scripts: `cap:sync`, `ios`, `android`, etc., that wrap `npx cap copy` / `npx cap open` for local DX.
3. Add Capacitor `native-run` targets to `.gitignore` (ios/android build outputs) to prevent unwanted commits.
4. Initialize the iOS and Android platforms (`npx cap add ios`, `npx cap add android`) and commit generated native folders (after confirming repo policy allows native projects).
5. Configure shared Capacitor settings such as `server.url` overrides for debug builds, splash icon resources, and version codes for both platforms.
6. Document configuration touchpoints inside the repo (e.g., `src/config/app-config.ts`, `.env.example`) that must diverge between native and web builds and add placeholders for native-only secrets.

### B. Web App Adaptations for Capacitor
1. **Entry point adjustments** (`src/main.tsx` / `App.tsx`): ensure the app waits for Capacitor plugins when running natively (e.g., guard `window.Capacitor` usage, wrap push init in `platform.isNativePlatform()` checks) and support Android splash flow via `App.addListener('appStateChange', ...)`.
2. **Environment configuration**: introduce platform detection helper (web vs. native, iOS vs. Android) to toggle features (e.g., disable `BrowserRouter` history fallback issues by using `HashRouter` in native if necessary, configure `capacitor.config.ts` server with `iosScheme: 'capacitor'` / Android `androidScheme`, and handle Android back button logic).
3. **File handling**: review any direct `window` APIs that may need Capacitor alternatives (e.g., file downloads via `file-saver`, `jszip`) and add conditional handling for native mode (potentially via Capacitor Filesystem/Share) with explicit checks for Android scoped storage quirks.
4. Audit existing analytics/error tracking (`src/lib/telemetry` or equivalent) to ensure native builds respect user consent flows and handle offline queuing.

### C. Offline-First Enhancements
1. Introduce a service worker build using `vite-plugin-pwa` (Workbox-based) or a custom service worker script:
   - Precache build assets + static HTML shell.
   - Runtime caching strategies for Supabase REST/GraphQL endpoints (network-first with cache fallback + TTL via Workbox `ExpirationPlugin`).
   - Background sync or queued mutations for critical POST/PUT (investigate compatibility with Supabase's RPCs; may start with queued tasks storing requests in IndexedDB until connectivity is restored).
2. Implement a lightweight client-side cache helper (`cachedJson` pattern) using `idb-keyval` for fetches triggered outside TanStack Query, ensuring TTL invalidation.
3. Add offline UX touches:
   - Global offline detector (via `navigator.onLine` + `window.addEventListener('online'/'offline')`) to show a banner or toast (Radix/Sonner) and disable mutating actions while offline.
   - Provide explicit guidance in pages that rely heavily on live data (e.g., Dashboard, ActivityCenter) to show cached snapshot state.
4. Validate that Supabase auth/session persistence works offline (Supabase JS stores session in localStorage); confirm service worker doesn't intercept auth token refresh calls unexpectedly.
5. Capture metrics on cache effectiveness (hit/miss logging) to gauge offline readiness and inform future tuning; store results in `localStorage` or emit to analytics when connectivity is restored.

### D. Push Notification Infrastructure
1. Add Capacitor Push Notifications + Local Notifications packages to `package.json`.
2. Create `src/lib/push.ts` (or similar) to encapsulate push registration workflow:
   - Request permissions only on native platforms.
   - Store the platform token in Supabase (new table `push_devices` with `user_id`, `token`, `platform`, `last_seen_at`, `app_version`).
   - Handle listeners for foreground/background notifications; provide UI hooks for new notifications (update `ActivityCenter` or global toast).
3. Extend Supabase backend (if accessible) or create a small Node serverless endpoint to exchange APNs token for FCM token when using Firebase Admin (if direct FCM registration is implemented client-side, ensure secure storage of tokens).
4. **iOS specifics:** native layer updates (`ios/App/App/AppDelegate.swift`) to configure Firebase SDK, set `UNUserNotificationCenter` delegate, forward device tokens to Capacitor, and ensure required entitlements (`aps-environment`).
5. **Android specifics:** configure Firebase in `android/app/src/main/AndroidManifest.xml`, add Google Services Gradle plugin, set up notification channel defaults, and handle background payload parsing in `MainActivity`.
6. Provide documentation for provisioning: generating APNs Auth Key, uploading to Firebase, placing `GoogleService-Info.plist` in the iOS project, and adding `google-services.json` for Android.
7. Collaborate with backend team to define payload schemas and expected actions when a push is tapped; update Activity Center or relevant TanStack Query caches when notifications are received.

### E. Build & Release Flow
1. Document developer workflow:
   - `npm run build` → `npx cap copy ios` → open Xcode for native build.
   - `npm run build` → `npx cap copy android` → open Android Studio for native build.
   - For web deployment, continue using `npm run build` & static hosting.
   - Outline environment-specific config (e.g., `.env.native` vs `.env.web` if Supabase endpoints differ).
2. Add GitHub Actions or CI scripts (optional) to run `npm run build` + `npm run lint` + `npx cap sync` in PR validations, including both platforms to catch Gradle or CocoaPods drift.
3. Provide manual QA checklist (below) to ensure no regressions.
4. Define release steps for both stores: TestFlight/Apple App Store, and Google Play internal testing, including signing key management and version bump cadence.

## 4. Detailed Task Breakdown & Sequencing
1. **Preparation (Day 0-1)**
   - Upgrade dependencies if required (ensure Node 18+).
   - Audit existing modules for browser-only APIs (file downloads, `window.print`, etc.).
   - Set up Firebase project + Apple Developer credentials (outside repo scope).
   - Identify QA devices (minimum supported iOS/Android versions) and ensure certificates/profiles can be shared with the team.
2. **Capacitor bootstrap (Day 1-2)**
   - Install Capacitor packages, create `capacitor.config.ts`.
   - Initialize iOS and Android platforms; ensure builds work (`npx cap sync ios`, `npx cap sync android`).
   - Commit generated config and update docs.
   - Configure automated Prettier/ESLint checks on new native config files to keep formatting consistent (or document manual formatting expectations if linting is not applied there).
3. **Service worker & offline caching (Day 2-4)**
   - Introduce `vite-plugin-pwa` (configure `registerType: 'autoUpdate'`).
   - Author Workbox strategies: precache route, runtime caches for Supabase REST endpoints (domain `*.supabase.co`), third-party assets, and fallback page.
   - Implement offline indicator component + hook into global layout.
   - Write integration tests (where possible) or manual QA steps for offline mode.
   - Coordinate with security review to ensure cached data complies with retention policies (sensitive PDFs, personally identifiable information, etc.).
4. **Data caching helpers (Day 3-4)**
   - Add `idb-keyval`, wrap fetch logic (utilizing TanStack Query `queryClient` with `staleTime` offline logic).
   - Provide TTL-based caching for heavy API responses (Equipment, Projects, etc.).
   - Create fallback rendering components that surface when cached data is older than a defined threshold and prompt manual refresh when connectivity returns.
5. **Push notifications (Day 4-6)**
   - Implement `initPush()` utility; integrate into `AppInit` or top-level effect once user authenticated.
   - Create Supabase table + API to store tokens (SQL migration if repository includes Supabase definitions under `supabase/` – update accordingly).
   - Configure Firebase SDK in iOS and Android projects; add bridging code and ensure background handlers are wired.
   - Provide fallback for web (skip push registration, optionally degrade to email/Sonner notifications).
   - Draft incident-response procedure for revoked push certificates/keys and add to ops documentation.
6. **Native feature parity (Day 6-7)**
   - Audit file download/export flows (Excel/PDF) and adapt with Capacitor Share/Filesystem to ensure they work on iOS and Android (include scoped storage testing on Android 13+).
   - Verify camera/file inputs (if used) behave correctly inside Capacitor WebView across both platforms.
   - Confirm deep links (if required) are mapped through Capacitor `AppUrlOpen` handler and routed correctly in React Router.
7. **Testing & QA (Day 7-8)**
   - Unit tests: run existing ones (if present) + add tests for new helpers.
   - E2E manual: offline scenario, push registration, login/out, navigation.
   - Archive build in Xcode and Android Studio, run on physical devices for push notifications.
   - Capture QA feedback in shared tracker; schedule regression sweeps after each Capacitor CLI upgrade.

## 5. Risk Mitigation & Compatibility
- **Routing nuances:** BrowserRouter history may need `iosScheme` adjustments on iOS; on Android ensure the hardware back button maps cleanly to router history and doesn't exit the app unexpectedly.
- **Supabase session refresh:** Service worker should bypass caching for `supabase.co/auth/v1/token`. Configure Workbox `NetworkOnly` for auth refresh endpoints.
- **Large assets (js-dos files, PDFs):** Precache only essential assets; use runtime caching with `RangeRequestsPlugin` if streaming is required.
- **Background tasks:** iOS limits background execution; rely on push notifications with payload data for updates instead of background fetch. Android supports background services but respect Doze mode; avoid long-running tasks.
- **Platform-specific permissions:** Document runtime permissions required on Android (notifications, camera, file storage) and ensure graceful fallback when denied.
- **CI/CD impact:** Ensure the addition of Capacitor doesn't break existing `npm run build`. Possibly add `postbuild` script to copy `manifest.json` and service worker outputs.
- **Store compliance:** Track Apple and Google guidelines for push notification usage, privacy manifests, and data safety forms; plan time for legal review before submission.
- **Future upgrades:** Document strategy for upgrading Capacitor major versions and keeping native dependencies aligned with React Native and WebView security patches.

## 6. Deliverables
1. Updated project dependencies (`package.json`, lockfile) with Capacitor and PWA tooling.
2. `capacitor.config.ts`, `ios/` and `android/` platform directories, and documentation in `README.md` or `docs/mobile.md` for setup.
3. Service worker implementation + offline banner component + caching helpers.
4. Push notification integration (web-safe checks) with Supabase token storage logic.
5. Documentation covering:
   - Local dev workflow for iOS and Android builds.
   - Steps to manage APNs/FCM keys and Android signing keystores.
   - Offline behavior expectations and troubleshooting.
6. QA checklist and regression test notes ensuring no disruption to existing web experience.

## 7. Testing Strategy
- `npm run lint` & `npm run build` (web) must continue to pass.
- Manual testing matrix:
  - Web (Chrome, Safari) online/offline toggles.
  - iOS simulator + physical device (login, navigation, file exports, offline prompts, push receipt).
  - Android emulator + physical device (login, navigation, push receipt, storage interactions, back button behavior).
- Optional automation: integrate Playwright or Cypress for core flows; consider `@capacitor/cli sync` command in CI to ensure config remains valid.

## 8. Open Questions / Clarifications Needed
1. **Native repo policy:** Should the generated `ios/` and `android/` folders live in this repository, or do we need an alternative hosting strategy?
2. **Minimum OS versions:** What are the baseline iOS and Android OS versions we must support (impacts WebView features and push notification behavior)?
3. **Supabase schema changes:** Can we create new tables/functions directly in this repo's Supabase migrations, and who owns the production rollout?
4. **Push notification payload source:** Which backend service(s) will be responsible for sending notifications, and do we need multi-tenant segregation of tokens?
5. **Offline data retention:** Are there compliance constraints around caching sensitive information (e.g., per-customer PII) that should limit offline storage duration or scope?
6. **Analytics integration:** Should native builds report to the existing analytics platform, or is a separate mobile analytics stack required?
7. **Timeline constraints:** Are there hard deadlines from business stakeholders (store launch dates) that should adjust the sequencing or resource allocation above?

## 9. Next Steps
- Confirm team approval of this plan and lock timelines.
- Begin implementation with Capacitor bootstrap while coordinating with backend team for push token storage and FCM integration.
