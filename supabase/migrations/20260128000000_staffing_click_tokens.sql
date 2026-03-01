-- Migration: Add WhatsApp short-link columns to staffing_requests
-- Instead of a separate table, store short tokens directly on the request row.
-- staffing_requests already has token_hash, token_expires_at, and status
-- which cover expiration and idempotency.

alter table public.staffing_requests
  add column if not exists wa_confirm_token text,
  add column if not exists wa_decline_token text,
  add column if not exists hmac_token_raw text;

-- Unique indexes for fast token lookup from Cloudflare Pages Function
create unique index if not exists staffing_requests_wa_confirm_token_idx
  on public.staffing_requests (wa_confirm_token)
  where wa_confirm_token is not null;

create unique index if not exists staffing_requests_wa_decline_token_idx
  on public.staffing_requests (wa_decline_token)
  where wa_decline_token is not null;

comment on column public.staffing_requests.wa_confirm_token is 'Short random token for WhatsApp confirm URL (/a/<token>)';
comment on column public.staffing_requests.wa_decline_token is 'Short random token for WhatsApp decline URL (/a/<token>)';
comment on column public.staffing_requests.hmac_token_raw is 'Raw base64url HMAC token for forwarding to staffing-click Edge Function';
