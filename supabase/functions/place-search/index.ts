// Edge Function: place-search

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SearchRequestBody = {
  type: 'search';
  query?: string;
  languageCode?: string;
  regionCode?: string;
};

type DetailsRequestBody = {
  type: 'details';
  placeId?: string;
};

type RequestBody = SearchRequestBody | DetailsRequestBody;

type Suggestion = {
  place_id: string;
  name: string;
  formatted_address: string;
};

type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address: string;
  coordinates?: { lat: number; lng: number };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('place-search: GOOGLE_MAPS_API_KEY missing');
      return new Response(JSON.stringify({ error: 'API key not available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Partial<RequestBody> | null;
    console.log('place-search: incoming body', body);

    if (!body || typeof body !== 'object' || !('type' in body)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.type === 'search') {
      const query = body.query?.trim();
      if (!query || query.length < 2) {
        console.warn('place-search: query missing or too short', { query });
        return new Response(JSON.stringify({ suggestions: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const languageCode = body.languageCode || 'es';
      const regionCode = body.regionCode || 'ES';

      // Try Places Text Search first
      const textSearchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 6,
          languageCode,
          regionCode,
        }),
      });

      if (!textSearchResponse.ok) {
        const txt = await textSearchResponse.text().catch(() => '');
        console.error('place-search: text search error', textSearchResponse.status, txt);
      } else {
        const data = await textSearchResponse.json();
        console.log('place-search: text search results', data?.places?.length ?? 0);
        if (Array.isArray(data?.places) && data.places.length > 0) {
          const suggestions: Suggestion[] = data.places.map((p: any) => ({
            place_id: p.id,
            name: p.displayName?.text ?? p.formattedAddress ?? query,
            formatted_address: p.formattedAddress ?? '',
          }));

          return new Response(JSON.stringify({ suggestions }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Fallback to Autocomplete
      const autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
          input: query,
          maxResultCount: 6,
          languageCode,
          regionCode,
        }),
      });

      if (!autocompleteResponse.ok) {
        const txt = await autocompleteResponse.text().catch(() => '');
        console.error('place-search: autocomplete error', autocompleteResponse.status, txt);
        return new Response(JSON.stringify({
          error: 'Google Places autocomplete error',
          status: autocompleteResponse.status,
          details: txt || 'Unknown error',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const autocompleteData = await autocompleteResponse.json();
      console.log('place-search: autocomplete suggestions', autocompleteData?.suggestions?.length ?? 0);
      const suggestions: Suggestion[] = Array.isArray(autocompleteData?.suggestions)
        ? autocompleteData.suggestions
            .filter((s: any) => s?.placePrediction?.placeId)
            .map((s: any) => ({
              place_id: s.placePrediction.placeId,
              name:
                s.placePrediction.structuredFormat?.mainText?.text ??
                s.placePrediction.text?.text ??
                query,
              formatted_address:
                s.placePrediction.structuredFormat?.secondaryText?.text ??
                s.placePrediction.text?.text ??
                '',
            }))
        : [];

      return new Response(JSON.stringify({ suggestions }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.type === 'details') {
      const placeId = body.placeId?.trim();
      if (!placeId) {
        return new Response(JSON.stringify({ error: 'placeId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
        },
      });

      if (!detailsResponse.ok) {
        const txt = await detailsResponse.text().catch(() => '');
        console.error('place-search: details error', detailsResponse.status, txt);
        return new Response(JSON.stringify({
          error: 'Google Places details error',
          status: detailsResponse.status,
          details: txt || 'Unknown error',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const place = await detailsResponse.json();
      console.log('place-search: details retrieved', place?.id);
      const result: PlaceDetails = {
        place_id: place?.id ?? placeId,
        name: place?.displayName?.text ?? '',
        formatted_address: place?.formattedAddress ?? '',
        coordinates: place?.location
          ? {
              lat: place.location.latitude,
              lng: place.location.longitude,
            }
          : undefined,
      };

      return new Response(JSON.stringify({ place: result }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported request type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('place-search: unexpected error', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
