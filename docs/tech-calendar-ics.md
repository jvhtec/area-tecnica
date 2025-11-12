Technician ICS Calendar Feed (Phase 1)
=====================================

This Edge Function exposes a read‑only, per‑technician iCalendar (ICS) feed that calendar apps (Google, Apple, Outlook) can subscribe to. It publishes confirmed assignments with job timing as UTC events.

Function
--------
- Path: `supabase/functions/tech-calendar-ics/index.ts`
- URL: `${SUPABASE_URL}/functions/v1/tech-calendar-ics?tid=<profile_id>&token=<calendar_ics_token>`
 - Public access: `supabase/functions/tech-calendar-ics/config.toml` sets `verify_jwt = false` so Google/Apple can fetch without auth headers.

Security
--------
- Each profile has a secret `calendar_ics_token` that is required in the URL. The function validates `tid` and `token` against `public.profiles` using the service role key.
- Tokens are generated automatically by migration for existing rows and set as default for new rows.
- Rotate a token by updating `profiles.calendar_ics_token` to a new random value; the previous URL will stop working.

Database changes
----------------
- Migration: `20251112103000_add_calendar_ics_token.sql`
  - Adds `profiles.calendar_ics_token text unique not null default encode(gen_random_bytes(18), 'hex')` (backfilled for existing rows).

Parameters
----------
- `tid` (required): Profile UUID of the technician.
- `token` (required): Secret token from `profiles.calendar_ics_token`.
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
