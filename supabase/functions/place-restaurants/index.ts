// Edge Function: place-restaurants

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    console.log('Place restaurants function called with method:', req.method);
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const { location, radius = 2000, maxResults = 20, placeId, details = false } = body || {};

    // Accept coordinates from body if provided
    const coords =
      body?.coordinates && typeof body.coordinates.lat === 'number' && typeof body.coordinates.lng === 'number'
        ? { lat: body.coordinates.lat, lng: body.coordinates.lng }
        : (typeof body?.latitude === 'number' && typeof body?.longitude === 'number'
            ? { lat: body.latitude, lng: body.longitude }
            : undefined);

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('Google Maps API key not found in environment');
      return new Response(JSON.stringify({ error: 'API key not available' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Place details by ID
    if (details && placeId) {
      const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
      const detailsResponse = await fetch(detailsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,priceLevel,types,internationalPhoneNumber,websiteUri,location,photos'
        }
      });
      if (!detailsResponse.ok) {
        const txt = await detailsResponse.text().catch(()=>'');
        console.error('Place details API error', detailsResponse.status, txt);
        let parsed: any = undefined;
        try { parsed = JSON.parse(txt); } catch {}
        return new Response(JSON.stringify({
          error: 'Google Places details error',
          status: detailsResponse.status,
          details: parsed || txt || 'Unknown error'
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      const detailsData = await detailsResponse.json();
      return new Response(JSON.stringify({ restaurant: detailsData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine coordinates
    let lat: number | undefined;
    let lng: number | undefined;

    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      console.log('Using provided coordinates:', { lat, lng });
    } else {
      if (!location) {
        return new Response(JSON.stringify({ error: 'Location or coordinates are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      console.log('Geocode status:', geocodeData?.status);
      if (!geocodeData.results || geocodeData.results.length === 0) {
        return new Response(JSON.stringify({ error: 'Location not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      lat = geocodeData.results[0].geometry.location.lat;
      lng = geocodeData.results[0].geometry.location.lng;
    }

    // Nearby search (Places API v1)
    const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.internationalPhoneNumber,places.websiteUri,places.location,places.photos'
      },
      body: JSON.stringify({
        includedPrimaryTypes: ['restaurant'],
        maxResultCount: Math.min(maxResults, 20),
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius
          }
        },
        languageCode: 'es',
        regionCode: 'ES'
      })
    });

    if (!searchResponse.ok) {
      const txt = await searchResponse.text().catch(()=>'');
      console.error('Places search API error', searchResponse.status, txt);
      let parsed: any = undefined;
      try { parsed = JSON.parse(txt); } catch {}
      return new Response(JSON.stringify({
        error: 'Google Places search error',
        status: searchResponse.status,
        details: parsed || txt || 'Unknown error'
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const searchData = await searchResponse.json();
    const places = searchData.places || [];

    const restaurants = places.map((place: any) => {
      const distance = calculateDistance(lat!, lng!, place.location.latitude, place.location.longitude);
      let photos: string[] = [];
      if (place.photos && place.photos.length > 0) {
        photos = place.photos.slice(0, 3).map((photo: any) => photo.name);
      }
      return {
        id: place.id,
        place_id: place.id,
        name: place.displayName?.text || '',
        formatted_address: place.formattedAddress || '',
        rating: place.rating,
        price_level: mapPriceLevel(place.priceLevel),
        types: place.types || [],
        formatted_phone_number: place.internationalPhoneNumber,
        website: place.websiteUri,
        geometry: { location: { lat: place.location.latitude, lng: place.location.longitude } },
        distance,
        photos
      };
    });

    restaurants.sort((a: any, b: any) => a.distance - b.distance);
    return new Response(JSON.stringify({ restaurants }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in place-restaurants function:', error);
    return new Response(JSON.stringify({
      error: 'Failed to search restaurants',
      details: error?.message || String(error)
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function mapPriceLevel(priceLevel?: string): number | undefined {
  if (!priceLevel) return undefined;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4
  };
  return map[priceLevel] ?? undefined;
}
