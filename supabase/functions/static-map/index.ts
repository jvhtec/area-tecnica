// Edge Function: static-map
//
// Returns a static map image (as a data URL) for the given coordinates or
// address. Backed by the Mapbox Static Images API (no Google billing).

import { mapboxGeocode } from '../_shared/mapboxGeocode.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MAX_DIM = 1280;

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
    const token = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Mapbox token not available' }), {
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
    } = body || {};

    let centerLat: number | undefined = typeof lat === 'number' ? lat : undefined;
    let centerLng: number | undefined = typeof lng === 'number' ? lng : undefined;

    if ((centerLat === undefined || centerLng === undefined) && address) {
      const geocoded = await mapboxGeocode(address, token);
      if (geocoded) {
        centerLat = geocoded.lat;
        centerLng = geocoded.lng;
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

    const w = Math.min(Math.max(Math.floor(width), 1), MAX_DIM);
    const h = Math.min(Math.max(Math.floor(height), 1), MAX_DIM);

    const overlay = `pin-s+ff0000(${centerLng},${centerLat})`;
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/${centerLng},${centerLat},${zoom}/${w}x${h}@2x?access_token=${token}`;

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
