# Sector Pro

## Project info

**URL**: https://lovable.dev/projects/d0a166bb-d73b-4553-8f2b-be914bc1e2d8

## How can I edit this code?

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d0a166bb-d73b-4553-8f2b-be914bc1e2d8) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)

## Push notifications & offline setup

The web client already registers a production service worker, caches the app shell for offline visits, and exposes enable/disable controls for push notifications. To make the feature work in your own environment:

1. **Generate VAPID keys** using `npx web-push generate-vapid-keys` and store the private key on your backend.
2. **Expose the public key to the client** by adding it to `.env` as `VITE_VAPID_PUBLIC_KEY` (see `.env.example`).
3. **Deploy the Supabase Edge Function** in `supabase/functions/push` (JWT-protected) which now handles subscribe, unsubscribe, and test fan-out logic against the `push_subscriptions` table.
4. **Send push payloads** (≤ 4 KB) that follow the schema in `docs/pwa-push-offline-plan.md` whenever relevant events occur. Use the saved VAPID keys when calling `web-push` (or your push service of choice).
5. **Verify service worker delivery** by building the app (`npm run build`), serving the production output (`npm run preview`), and confirming that enabling push in Settings succeeds and produces a persisted subscription on the backend.
6. **Store the generated VAPID keys** (see `docs/pwa-push-credentials.md`) in your secret manager and expose the public key to the client via `VITE_VAPID_PUBLIC_KEY`.

Offline support currently covers the core app shell. Expand the cache list in `public/sw.js` or add runtime caching if additional assets or API responses should be available while offline.

## Corporate email inline images

Inline images uploaded through the corporate email composer are stored temporarily in the `corporate-emails-temp` storage bucket. The send flow retains these files for the configured retention window (default 7 days) so recipients can continue viewing the content. A scheduled Supabase Edge Function (`cleanup-corporate-email-images`) purges expired files and retries any paths that could not be deleted automatically. For setup instructions and operational guidance, see [`docs/corporate-email-inline-image-retention.md`](docs/corporate-email-inline-image-retention.md).
