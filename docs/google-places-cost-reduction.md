# Google Places / Maps cost reduction → Mapbox migration

## Goal

Bring the monthly Google Maps Platform bill to €0 with **no loss of features**, by
moving everything Mapbox can do to Mapbox (free tier) and keeping only the
genuinely Google-only features (restaurant ratings/price/phone, venue photos) on
Google — server-side and cached so they stay under Google's free tier.

The Google API key is **already restricted** (HTTP referrers + API restrictions +
budget cap) in Google Cloud Console, so remaining charges were legitimate app
usage. This change removes that usage.

## What changed

### Phase 1 — Migrated to Mapbox (no feature loss)

| Feature | Before (Google) | After (Mapbox) |
|---|---|---|
| Address autocomplete | Places Text Search per keystroke | `AddressAutocomplete` → Search Box (session-token billing) |
| City autocomplete | Places Text Search per keystroke | `CityAutocomplete` → Search Box |
| Place/venue autocomplete | Places Text Search per keystroke | `PlaceAutocomplete` → Search Box |
| Hotel autocomplete | Places Text Search per keystroke | `HotelAutocomplete` → Search Box (`poi_category=hotel`) |
| Interactive map | Maps JavaScript API | `GoogleMap.tsx` → Mapbox GL JS |
| Tour map | (already on Mapbox) | `TourMapViewMapbox` — dead `TourMapView.tsx` removed |
| Static map in job/tech/festival modals | Static Maps `<img>` (auto-rendered, key in URL) | Mapbox Static Images via `getStaticMapUrlForLocation` |
| Geocoding | Geocoding API | Mapbox Geocoding v6 |
| PDF maps (Hoja de Ruta) | Static Maps + Geocoding | `MapService` → Mapbox |

All Mapbox calls go through the shared helper **`src/lib/mapbox/mapboxClient.ts`**
(token fetch, static URLs, geocoding, Search Box suggest/retrieve with session
tokens). The Mapbox public token is delivered by the existing `get-mapbox-token`
edge function and is safe to expose to the browser (URL-restricted by design).

### Phase 2 — Kept on Google, but optimized

Mapbox has no ratings / price level / phone / website, so **restaurants** stay on
Google but are now cheap:

- **Restaurant search/details** (`place-restaurants`) now persists responses in a
  new `place_api_cache` table (migration `20260622120000_place_api_cache.sql`).
  Each venue is searched at most once per cache window (30 days).
- `place-restaurants` now geocodes the venue address with **Mapbox** (via
  `_shared/mapboxGeocode.ts`) instead of paid Google Geocoding.
- The browser fallbacks that called Google directly were removed from
  `PlacesRestaurantService` — restaurants now go exclusively through the edge
  function.

### Venue/accommodation photos — now free via Wikimedia

The photo feature was previously **disabled everywhere** (commented out) because
it used the paid Google Places Photo Media API. It is now **re-enabled and free**:

- `place-photos` fetches images from **Wikimedia** — Wikipedia article lead images
  matching the venue/hotel name, plus a Wikimedia **Commons geosearch** fallback
  around the coordinates when available. No API key, no billing.
- Results are cached persistently (180 days) and returned as base64 data URLs so
  they embed directly into PDFs.
- Re-enabled call sites: PDF `venue.ts` and `accommodation.ts` auto-fetch, and the
  live `ModernVenueSection` photo suggestion. Manual uploads still take priority;
  Wikimedia only fills in when there's room.
- Coverage note: Wikimedia has photos for most notable venues/arenas/theaters and
  many hotels, but not every small business. When nothing is found, the section
  simply falls back to manual upload (unchanged UX).

### Phase 3 — Hardening (Google key never leaves the server)

- All client code that fetched the raw Google key (`get-google-maps-key`) is gone.
- `get-google-maps-key` is **deprecated**: it now returns `410 Gone` and never
  returns the key (still audited). The Google key now only exists server-side in
  `GOOGLE_MAPS_API_KEY`, used by `place-restaurants` and `place-photos`.

## Deployment steps

1. **Apply the migration** (creates the cache table):
   ```bash
   npx supabase db push    # or apply 20260622120000_place_api_cache.sql
   ```
2. **Deploy the edge functions**:
   ```bash
   npx supabase functions deploy place-photos place-restaurants static-map get-google-maps-key
   ```
3. **Confirm secrets** (already set, verify): `MAPBOX_PUBLIC_TOKEN`, `GOOGLE_MAPS_API_KEY`.
4. Deploy the frontend as usual (Cloudflare Pages).

## Expected outcome

- Maps, geocoding, and all autocomplete run on Mapbox (free tier covers this volume).
- Google Places usage drops to restaurant search + photos only, served from cache
  after the first lookup per venue → under Google's free tier → **€0/month**.
- No user-facing feature was removed.
