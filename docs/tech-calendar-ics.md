Technician ICS Calendar Feed (Phase 1)
=====================================

This Edge Function exposes a read‑only, per‑technician iCalendar (ICS) feed that calendar apps (Google, Apple, Outlook) can subscribe to. It publishes confirmed assignments with job timing as UTC events.

Function
--------
- Path: `supabase/functions/tech-calendar-ics/index.ts`
- URL: `${SUPABASE_URL}/functions/v1/tech-calendar-ics?tid=<profile_id>&token=<ics_token>&apikey=<anon_key>`
 - Public access: `supabase/functions/tech-calendar-ics/config.toml` sets `verify_jwt = false` so Google/Apple can fetch without auth headers. The anon key is included as a query parameter to bypass Supabase's infrastructure authentication.

Security
--------
- Each profile has a secret ICS token that is required in the URL. The function validates `tid` and `token` against `public.profile_calendar_tokens` using the service role key, with a constant-time comparison. Missing rows and mismatches return 403; lookup failures return a retryable 503 so calendar clients do not discard a valid subscription during a transient outage.
- **The token is a bearer credential and does not remain on the client-readable profile row.** `public.profile_calendar_tokens` holds one row per profile with owner-only RLS and no authenticated write policy. The deprecated `profiles.calendar_ics_token` column remains temporarily so cached clients can select it, but its values and default are removed.
- The security migration generates a fresh token for every existing profile. This intentionally invalidates subscriptions that used credentials exposed by the former broad profile read.
- Clients read their own token with the RLS-backed, `SECURITY INVOKER` `get_my_calendar_ics_token()` function. They generate or rotate it through the self-scoped `SECURITY DEFINER` `rotate_my_calendar_ics_token()` function. Both are revoked from `anon`/`PUBLIC` and granted explicitly to `authenticated`.
- Rotating replaces the token and the previous URL stops working; the subscriber must re-add the feed.
- Operators should not `UPDATE` tokens by hand. To rotate everyone's token at once (for example after a suspected disclosure):
  ```sql
  UPDATE public.profile_calendar_tokens
     SET token = encode(extensions.gen_random_bytes(18), 'hex'),
         rotated_at = now();
  ```
  This invalidates every existing calendar subscription and forces each user to re-subscribe.

Database changes
----------------
- Migration: `20251112103000_add_calendar_ics_token.sql`
  - Added `profiles.calendar_ics_token text unique not null default encode(gen_random_bytes(18), 'hex')`. **Superseded — see below.**
- Migration: `20260904160000_move_calendar_ics_token_out_of_profiles.sql` (SEC-13)
  - Creates `public.profile_calendar_tokens` (`profile_id` PK → `profiles(id) ON DELETE CASCADE`, `token`, `created_at`, `rotated_at`), owner-only RLS, `SELECT` granted to `authenticated` and revoked from `anon`/`PUBLIC`.
  - Rotates every existing token instead of copying disclosed credentials.
  - Redefines `rotate_my_calendar_ics_token()` to upsert into the new table (signature and return value unchanged) and adds `get_my_calendar_ics_token()`.
  - Removes the default and values from `profiles.calendar_ics_token` while keeping the nullable column for one compatibility release. A later migration will drop it after older PWA bundles have aged out.
  - **Deploy order:** deploy the dual-read Edge Function and compatible web client first, then apply the migration. The Function falls back to the legacy column only when the vault table is absent; after migration it fails closed and accepts only rotated vault tokens.
  - Coverage proves owner isolation, direct-write and anonymous RPC denial, token rotation, and pre/post-migration reader behavior.

Parameters
----------
- `tid` (required): Profile UUID of the technician.
- `token` (required): Secret token from `profile_calendar_tokens.token`, obtained by the owner via `get_my_calendar_ics_token()`.
- `apikey` (required): Supabase anon key for authentication bypass.
- `back` (optional): Days back to include (default 90, max 365).
- `fwd` (optional): Days forward to include (default 365, max 730).

Event contents
--------------
- Summary format: `[role] Job Title (día YYYY-MM-DD)` for single‑day splits; otherwise `Job Title`.
- Times: UTC (`DTSTART/DTEND`) derived from job `start_time`/`end_time`. For single‑day assignments we reuse the job's time‑of‑day and attach it to the assignment date. If the window is invalid or missing, a 2‑hour default is used or an all‑day fallback for date‑only.
- Status: `CONFIRMED`.

Caching
-------
- Response headers include `Cache-Control: private, max-age=900` and an `ETag` based on the body so personal schedules are not retained by shared caches.

Notes & next steps
------------------
- This is a one‑way read‑only feed (no OAuth). It’s the quickest path to Calendar sync.
- If you need strict timezone fidelity per assignment date (DST transitions), consider adding a server‑side utility to compose local times using the job timezone per date, or introducing per‑day call times.
- Phase 2 (optional): OAuth‑backed Google Calendar sync, token storage and incremental push of changes.
