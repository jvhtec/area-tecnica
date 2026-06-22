-- Persistent server-side cache for Google Places API responses.
--
-- Photos and restaurant search/details remain on Google Places (Mapbox has no
-- equivalent rich-POI / photo data), but caching their responses ensures each
-- venue is fetched at most once, keeping paid Places usage under the free tier.
--
-- Used by the `place-photos` and `place-restaurants` edge functions, which run
-- with the service role. No RLS policies are defined, so only the service role
-- (which bypasses RLS) can read or write this table.

create table if not exists public.place_api_cache (
  cache_key  text primary key,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_place_api_cache_expires_at
  on public.place_api_cache (expires_at);

alter table public.place_api_cache enable row level security;

comment on table public.place_api_cache is
  'Server-side cache for Google Places API responses (place-photos, place-restaurants edge functions). Service-role access only.';
