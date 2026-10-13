import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { logEvent } from '../_shared/structuredLogger.ts';
import { HttpError, jsonResponse, readBoundedJsonObject, requireBearerToken } from '../_shared/http.ts';

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

export function createPlaceSearchHandler(supabase: SupabaseClient, apiKey: string) {
  return async (req: Request): Promise<Response> => {
    const token = requireBearerToken(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new HttpError(401, 'Invalid authentication');

    const body = await readBoundedJsonObject(req, { maxBytes: 2048 });
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length < 2 || query.length > 200) throw new HttpError(400, 'Query must contain 2–200 characters');

    // Share the existing restaurant budget: every paid request consumes both
    // the user's allowance and the project-wide allowance atomically.
    const { data: allowed, error: quotaError } = await supabase.rpc('consume_external_api_dual_quota', {
      p_user_actor_id: user.id,
      p_user_service: 'google_places',
      p_user_daily_limit: 100,
      p_global_actor_id: '00000000-0000-0000-0000-000000000000',
      p_global_service: 'google_places_global',
      p_global_daily_limit: 1000,
    });
    if (quotaError) throw new HttpError(503, 'Places quota unavailable');
    if (allowed !== true) throw new HttpError(429, 'Daily Places quota exceeded');

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 6,
        languageCode: 'es',
        // Google rejects viewports wider than 180 degrees. This broad bias
        // covers Europe without restricting results to a country or nearby area.
        // Explicit query locations override it; avoid datacenter IP bias.
        locationBias: { rectangle: {
          low: { latitude: -90, longitude: -90 },
          high: { latitude: 90, longitude: 90 },
        } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null) as {
        error?: { status?: string; message?: string };
      } | null;
      const summary = typeof problem?.error?.message === 'string'
        ? problem.error.message.replaceAll(apiKey, '[REDACTED]').replaceAll(query, '[REDACTED_QUERY]')
        : 'No structured provider error';
      logEvent('error', 'place_search.provider_rejected', {
        upstream_status: response.status,
        upstream_code: typeof problem?.error?.status === 'string' ? problem.error.status : 'UNKNOWN',
        upstream_summary: summary,
      });
      throw new HttpError(502, 'Google Places search failed');
    }
    const data = await response.json() as { places?: GooglePlace[] };
    const places = (data.places ?? []).map((place) => ({
      place_id: place.id,
      name: place.displayName?.text || place.formattedAddress || query,
      address: place.formattedAddress || '',
      coordinates: place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined,
    }));
    return jsonResponse({ places }, { headers: { 'Cache-Control': 'no-store' } });
  };
}
