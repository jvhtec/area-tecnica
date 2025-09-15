// Edge Function: static-map

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
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      lat,
      lng,
      address,
      width = 600,
      height = 300,
      zoom = 15,
      scale = 2,
    } = body || {};

    let centerLat: number | undefined = typeof lat === 'number' ? lat : undefined;
    let centerLng: number | undefined = typeof lng === 'number' ? lng : undefined;

    if ((centerLat === undefined || centerLng === undefined) && address) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const geocodeRes = await fetch(geocodeUrl);
      if (!geocodeRes.ok) {
        return new Response(JSON.stringify({ error: 'Geocoding failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const geocodeData = await geocodeRes.json();
      const location = geocodeData?.results?.[0]?.geometry?.location;
      if (location) {
        centerLat = location.lat;
        centerLng = location.lng;
      } else {
        return new Response(JSON.stringify({ error: 'Address not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (centerLat === undefined || centerLng === undefined) {
      return new Response(JSON.stringify({ error: 'Latitude/Longitude or address is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clamp dimensions to Static Maps API limits; use <= 640px per dimension
    const w = Math.min(Math.max(Math.floor(width), 1), 640);
    const h = Math.min(Math.max(Math.floor(height), 1), 640);
    const s = Math.min(Math.max(Math.floor(scale), 1), 2);

    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=${zoom}&size=${w}x${h}&scale=${s}&format=png&maptype=roadmap&markers=size:tiny%7Ccolor:red%7C${centerLat},${centerLng}&key=${apiKey}`;

    const mapRes = await fetch(url);
    if (!mapRes.ok) {
      const txt = await mapRes.text().catch(()=>'');
      return new Response(JSON.stringify({ error: 'Static map fetch failed', status: mapRes.status, details: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blob = await mapRes.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${blob.type};base64,${base64}`;

    return new Response(JSON.stringify({ dataUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

