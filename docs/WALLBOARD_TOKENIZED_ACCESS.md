# Wallboard tokenized access

_Last updated: 2026-09-22_

Public wallboards use a shared deployment secret only to exchange for a short-lived,
preset-scoped wallboard JWT. They do not sign in with a browser-visible service
account.

## Routes

- Authenticated display: `/wallboard/:presetSlug?`
- Public display: `/wallboard/public/:sharedToken/:presetSlug?`

The public URL remains a bearer capability. Treat it as confidential, use HTTPS,
and rotate it if it is exposed through screenshots, browser history, support
logs, or copied links.

## Authentication flow

1. `WallboardPublic` sends the shared token and requested preset to
   `wallboard-auth`.
2. `wallboard-auth` compares the token with `WALLBOARD_SHARED_TOKEN` and signs
   a short-lived JWT using `WALLBOARD_JWT_SECRET`.
3. The browser sends that JWT in `x-wallboard-jwt` when invoking
   `wallboard-feed`.
4. The public page renews the scoped JWT before it expires. A transient renewal
   failure keeps the last displayed snapshot and retries; a rejected token
   triggers a new exchange.

The primary browser flow never sends the long-lived shared token to the feed.
For backward compatibility with older display clients, `wallboard-feed` still
accepts the shared token through its legacy headers/query parameter. Treat that
as a temporary compatibility surface and do not build new clients on it.

Authenticated admin, management, and wallboard users call the same snapshot
endpoint with their normal Supabase access token. The function verifies the user
and checks the persisted profile role before performing any privileged read.

## Canonical feed

`wallboard-feed /snapshot` is the single data contract used by public and
authenticated displays. The versioned response contains:

- generation timestamp and preset slug;
- overview and calendar jobs;
- required and assigned crew;
- crew names and timesheet status;
- document progress;
- pending staffing and overdue-timesheet actions;
- logistics events; and
- active announcements.

The display validates the complete snapshot envelope, including the server's
Madrid-safe calendar range and date buckets, and retains the previous good
snapshot if a refresh fails. Legacy per-panel endpoints remain available
temporarily for compatibility, but the application no longer assembles a second
feed directly in the browser.

## Required secrets

Set these only as Supabase Edge Function secrets:

```text
WALLBOARD_SHARED_TOKEN=<long random value>
WALLBOARD_JWT_SECRET=<different long random value>
WALLBOARD_JWT_TTL=<optional lifetime in seconds>
```

Never commit either secret. Do not expose service-role keys or wallboard account
credentials in `VITE_*` variables.

## Presets

Every slug, including `produccion`, `almacen`, and `oficinas`, loads its
configuration from `wallboard_presets`. The display respects the stored panel
list exactly, so removing a panel in the editor disables it. If `produccion`
does not exist, the deliberate fallback remains a calendar-only display.

Public preset configuration is read through the scoped wallboard API.
Authenticated management screens continue to edit presets through RLS-protected
database access.

## Deployment checks

1. Confirm both required secrets are configured.
2. Deploy `wallboard-auth` and `wallboard-feed`.
3. Open an authenticated wallboard as an allowed role.
4. Open a public wallboard URL and confirm the requested preset is used.
5. Verify one understaffed job, one document count, one logistics event, and one
   announcement against their source records.
6. Leave a display running through a JWT-renewal boundary.
7. Check Edge Function logs for authorization failures or snapshot query errors.

## Troubleshooting

- **Acceso denegado immediately:** the shared token is absent, incorrect, or the
  auth secrets are not configured.
- **Authenticated display receives 403:** the verified user's profile role is
  not `admin`, `management`, or `wallboard`.
- **Preset fallback appears:** the slug does not exist or preset configuration
  could not be loaded.
- **Snapshot rejected as malformed:** the deployed frontend and Edge Function
  versions do not share the same snapshot schema version.
- **Old data remains visible:** refresh failed; inspect the browser console and
  `wallboard-feed` logs. Keeping the last good snapshot is intentional.

The planned follow-up is per-device, revocable, hashed access tokens and screen
health telemetry. Until then, all public displays share the deployment token.
