-- Migration: Add staffing_click_tokens table for short WhatsApp links
-- This table stores tokens that map short URLs to staffing request actions

create table if not exists public.staffing_click_tokens (
  token text primary key,
  rid uuid not null references public.staffing_requests(id) on delete cascade,
  action text not null check (action in ('confirm','decline')),
  channel text not null default 'whatsapp',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  -- Store original HMAC token for forwarding to staffing-click Edge Function
  hmac_token text,
  -- Store the phase for token reconstruction if needed
  phase text
);

-- Index for efficient expiration cleanup
create index if not exists staffing_click_tokens_expires_at_idx
  on public.staffing_click_tokens (expires_at);

-- Index for looking up tokens by rid (for cleanup when request is deleted)
create index if not exists staffing_click_tokens_rid_idx
  on public.staffing_click_tokens (rid);

-- RLS policies
alter table public.staffing_click_tokens enable row level security;

-- Service role can do everything (for Edge Functions)
create policy "Service role full access"
  on public.staffing_click_tokens
  for all
  using (true)
  with check (true);

-- Grant permissions
grant select, insert, update, delete on public.staffing_click_tokens to service_role;
grant select on public.staffing_click_tokens to authenticated;

comment on table public.staffing_click_tokens is 'Stores short URL tokens for WhatsApp staffing click-through links';
comment on column public.staffing_click_tokens.token is 'Short random token for the URL (e.g., UUID without dashes)';
comment on column public.staffing_click_tokens.rid is 'Reference to the staffing_request this token belongs to';
comment on column public.staffing_click_tokens.action is 'The action this token represents: confirm or decline';
comment on column public.staffing_click_tokens.channel is 'Channel where this token was sent (whatsapp, email, etc)';
comment on column public.staffing_click_tokens.expires_at is 'When this token expires';
comment on column public.staffing_click_tokens.used_at is 'When this token was used (null if not yet used)';
comment on column public.staffing_click_tokens.hmac_token is 'Original HMAC token for forwarding to staffing-click Edge Function';
comment on column public.staffing_click_tokens.phase is 'Phase of the staffing request (availability or offer)';
