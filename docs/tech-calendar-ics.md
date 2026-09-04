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
- Each profile has a secret ICS token that is required in the URL. The function validates `tid` and `token` against `public.profile_calendar_tokens` using the service role key, with a constant-time comparison, and returns 403 on any mismatch.
- **The token is a bearer credential and deliberately does not live on the profile row.** `profiles` is readable by every authenticated user (`profiles_select` is `USING (true)`), so a token stored there was readable by any colleague, who could then fetch that person's calendar from this unauthenticated endpoint. `public.profile_calendar_tokens` holds one row per profile with RLS scoped to the owner, and no `INSERT`/`UPDATE`/`DELETE` policy for `authenticated` at all — the only write path is the definer function below.
- **Tokens are created lazily, not by default.** A new profile has no token row until one is generated. The UI handles this: the technician profile view generates on first sync, and the profile page's button reads "Generar enlace" until a token exists.
- Clients read their own token with `get_my_calendar_ics_token()` and generate or rotate it with `rotate_my_calendar_ics_token()`. Both are `SECURITY DEFINER` with a pinned `search_path`, revoked from `anon`/`PUBLIC`, granted to `authenticated`, and scoped to `auth.uid()` — they ignore any argument, so one user cannot address another's token.
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
  - Backfills every existing token before dropping the column, so live subscriptions survive the deploy.
  - Redefines `rotate_my_calendar_ics_token()` to upsert into the new table (signature and return value unchanged) and adds `get_my_calendar_ics_token()`.
  - Drops `profiles.calendar_ics_token`.
  - **Deploy order:** deploy this Edge Function before applying the migration, or feeds return 403 for the window between the two.
  - Coverage: `supabase/tests/database/profile_calendar_token_isolation.sql` proves one technician cannot read another's token.

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
- Response headers include `Cache-Control: public, max-age=900` and an `ETag` based on the body.

Notes & next steps
------------------
- This is a one‑way read‑only feed (no OAuth). It’s the quickest path to Calendar sync.
- If you need strict timezone fidelity per assignment date (DST transitions), consider adding a server‑side utility to compose local times using the job timezone per date, or introducing per‑day call times.
- Phase 2 (optional): OAuth‑backed Google Calendar sync, token storage and incremental push of changes.
