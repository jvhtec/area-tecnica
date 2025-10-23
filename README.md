# Sector Pro

## Push notifications & offline setup

The web client already registers a production service worker, caches the app shell for offline visits, and exposes enable/disable controls for push notifications. To make the feature work in your own environment:

1. **Generate VAPID keys** using `npx web-push generate-vapid-keys` and store the private key on your backend.
2. **Expose the public key to the client** by adding it to `.env` as `VITE_VAPID_PUBLIC_KEY` (see `.env.example`).
3. **Deploy the Supabase Edge Function** in `supabase/functions/push` (JWT-protected) which now handles subscribe, unsubscribe, and test fan-out logic against the `push_subscriptions` table.
4. **Send push payloads** (≤ 4 KB) that follow the schema in `docs/pwa-push-offline-plan.md` whenever relevant events occur. Use the saved VAPID keys when calling `web-push` (or your push service of choice).
5. **Verify service worker delivery** by building the app (`npm run build`), serving the production output (`npm run preview`), and confirming that enabling push in Settings succeeds and produces a persisted subscription on the backend.
6. **Store the generated VAPID keys** (see `docs/pwa-push-credentials.md`) in your secret manager and expose the public key to the client via `VITE_VAPID_PUBLIC_KEY`.

Offline support currently covers the core app shell. Expand the cache list in `public/sw.js` or add runtime caching if additional assets or API responses should be available while offline.
