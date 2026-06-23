import { supabase } from '@/integrations/supabase/client';

/**
 * Centralised Mapbox client helpers.
 *
 * All Mapbox calls go through the public token returned by the `get-mapbox-token`
 * edge function. Unlike the Google Maps key, the Mapbox public token is designed
 * to be exposed to the browser (and is URL-restricted in the Mapbox dashboard),
 * so it is safe to use directly from client code and inside `<img>` URLs.
 *
 * This module replaces the previous direct Google Places / Static Maps / Geocoding
 * usage that was driving billing. See docs/google-places-cost-reduction.md.
 */

const MAPBOX_API = 'https://api.mapbox.com';
const DEFAULT_STYLE = 'mapbox/streets-v12';
const MAX_STATIC_DIM = 1280;

export interface LatLng {
  lat: number;
  lng: number;
}

let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

/** Fetch (and memoize) the public Mapbox token via the edge function. */
export async function getMapboxToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) {
        console.error('Failed to fetch Mapbox token:', error);
        return null;
      }
      cachedToken = (data?.token as string | undefined) ?? null;
      return cachedToken;
    } catch (err) {
      console.error('Error fetching Mapbox token:', err);
      return null;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

export interface StaticMapOptions {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  zoom?: number;
  retina?: boolean;
  marker?: boolean;
  markerColor?: string;
  style?: string;
}

/** Build a Mapbox Static Images API URL (replacement for Google Static Maps). */
export function buildStaticMapUrl(token: string, opts: StaticMapOptions): string {
  const {
    lat,
    lng,
    width = 600,
    height = 300,
    zoom = 14,
    retina = true,
    marker = true,
    markerColor = 'ff0000',
    style = DEFAULT_STYLE,
  } = opts;

  const w = Math.min(Math.max(Math.floor(width), 1), MAX_STATIC_DIM);
  const h = Math.min(Math.max(Math.floor(height), 1), MAX_STATIC_DIM);
  const overlay = marker ? `pin-s+${markerColor}(${lng},${lat})/` : '';
  const hidpi = retina ? '@2x' : '';

  return `${MAPBOX_API}/styles/v1/${style}/static/${overlay}${lng},${lat},${zoom}/${w}x${h}${hidpi}?access_token=${token}`;
}

/**
 * Convenience helper: resolve a static map URL from either coordinates or an
 * address (geocoding only when coordinates are missing). Returns null if a
 * token can't be fetched or the address can't be geocoded.
 */
export async function getStaticMapUrlForLocation(opts: {
  lat?: number;
  lng?: number;
  address?: string;
  width?: number;
  height?: number;
  zoom?: number;
  marker?: boolean;
}): Promise<string | null> {
  const token = await getMapboxToken();
  if (!token) return null;

  let { lat, lng } = opts;
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && opts.address) {
    const geocoded = await geocodeForward(opts.address, token);
    if (!geocoded) return null;
    lat = geocoded.lat;
    lng = geocoded.lng;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return buildStaticMapUrl(token, {
    lat,
    lng,
    width: opts.width,
    height: opts.height,
    zoom: opts.zoom,
    marker: opts.marker,
  });
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  placeName: string;
}

/** Forward geocoding (address → coordinates) via the Mapbox Geocoding v6 API. */
export async function geocodeForward(
  query: string,
  token: string,
  opts: { country?: string; language?: string; types?: string; limit?: number } = {},
): Promise<GeocodeResult | null> {
  const { country, language = 'es', limit = 1, types } = opts;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    limit: String(limit),
    language,
  });
  if (country) params.set('country', country);
  if (types) params.set('types', types);

  let data: any;
  try {
    const res = await fetch(`${MAPBOX_API}/search/geocode/v6/forward?${params.toString()}`);
    if (!res.ok) return null;
    data = await res.json();
  } catch (err) {
    console.warn('Mapbox forward geocoding failed:', err);
    return null;
  }

  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
    return null;
  }

  return {
    lat: coords[1],
    lng: coords[0],
    placeName: feature?.properties?.full_address || feature?.properties?.name || query,
  };
}

/** Reverse geocoding (coordinates → address) via the Mapbox Geocoding v6 API. */
export async function geocodeReverse(
  lng: number,
  lat: number,
  token: string,
  opts: { language?: string } = {},
): Promise<string | null> {
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: token,
    limit: '1',
    language: opts.language ?? 'es',
  });

  let data: any;
  try {
    const res = await fetch(`${MAPBOX_API}/search/geocode/v6/reverse?${params.toString()}`);
    if (!res.ok) return null;
    data = await res.json();
  } catch (err) {
    console.warn('Mapbox reverse geocoding failed:', err);
    return null;
  }

  const feature = data?.features?.[0];
  return feature?.properties?.full_address || feature?.properties?.name || null;
}

/** Generate a session token for grouping Search Box suggest+retrieve calls (cheaper billing). */
export function createSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface SearchSuggestion {
  mapboxId: string;
  name: string;
  fullAddress: string;
}

export interface SearchBoxOptions {
  types?: string;
  country?: string;
  language?: string;
  limit?: number;
  proximity?: LatLng | 'ip';
  poiCategory?: string;
  signal?: AbortSignal;
}

/**
 * Mapbox Search Box "suggest" — type-ahead suggestions. Combined with
 * {@link searchBoxRetrieve} and a shared session token, an entire autocomplete
 * interaction is billed as a single search session instead of per keystroke.
 */
export async function searchBoxSuggest(
  query: string,
  token: string,
  sessionToken: string,
  opts: SearchBoxOptions = {},
): Promise<SearchSuggestion[]> {
  const { types, country, language = 'es', limit = 6, proximity = 'ip', poiCategory, signal } = opts;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    session_token: sessionToken,
    language,
    limit: String(limit),
  });
  if (types) params.set('types', types);
  if (country) params.set('country', country);
  if (poiCategory) params.set('poi_category', poiCategory);
  if (proximity === 'ip') params.set('proximity', 'ip');
  else if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);

  const res = await fetch(`${MAPBOX_API}/search/searchbox/v1/suggest?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Mapbox Search Box suggest error: ${res.status}`);
  }

  const data = await res.json();
  return (data?.suggestions || []).map((suggestion: any) => ({
    mapboxId: suggestion.mapbox_id,
    name: suggestion.name,
    fullAddress:
      suggestion.full_address ||
      [suggestion.name, suggestion.place_formatted].filter(Boolean).join(', ') ||
      suggestion.place_formatted ||
      '',
  }));
}

export interface RetrieveResult {
  name: string;
  address: string;
  coordinates?: LatLng;
}

/** Mapbox Search Box "retrieve" — resolve a suggestion to coordinates + address. */
export async function searchBoxRetrieve(
  mapboxId: string,
  token: string,
  sessionToken: string,
): Promise<RetrieveResult | null> {
  const params = new URLSearchParams({ access_token: token, session_token: sessionToken });

  const res = await fetch(
    `${MAPBOX_API}/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Mapbox Search Box retrieve error: ${res.status}`);
  }

  const data = await res.json();
  const feature = data?.features?.[0];
  if (!feature) return null;

  const coords = feature.geometry?.coordinates;
  return {
    name: feature.properties?.name || '',
    address: feature.properties?.full_address || feature.properties?.place_formatted || '',
    coordinates:
      Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number'
        ? { lat: coords[1], lng: coords[0] }
        : undefined,
  };
}
