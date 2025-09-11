import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  query: string;
  maxPhotos?: number;
  maxWidthPx?: number;
  maxHeightPx?: number;
}

async function fetchAsDataUrl(url: string, headers: HeadersInit): Promise<string | null> {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arr = new Uint8Array(await res.arrayBuffer());
  const base64 = btoa(String.fromCharCode(...arr));
  return `data:${contentType};base64,${base64}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GOOGLE_MAPS_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    const query = body.query?.toString().trim();
    const maxPhotos = Math.min(Math.max(body.maxPhotos ?? 2, 1), 5);
    const maxWidthPx = Math.min(Math.max(body.maxWidthPx ?? 500, 1), 1600);
    const maxHeightPx = Math.min(Math.max(body.maxHeightPx ?? 300, 1), 1600);

    if (!query) {
      return new Response(JSON.stringify({ photos: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Places Text Search v1
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    });
    if (!searchRes.ok) {
      return new Response(JSON.stringify({ photos: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const searchData = await searchRes.json();
    const place = searchData?.places?.[0];
    const photos = place?.photos || [];
    if (!photos.length) {
      return new Response(JSON.stringify({ photos: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: string[] = [];
    for (let i = 0; i < Math.min(maxPhotos, photos.length); i++) {
      const name = photos[i]?.name; // places/PLACE_ID/photos/PHOTO_ID
      if (!name) continue;
      const mediaUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}`;
      try {
        const dataUrl = await fetchAsDataUrl(mediaUrl, { 'X-Goog-Api-Key': apiKey });
        if (dataUrl) results.push(dataUrl);
      } catch (_e) {
        // ignore
      }
    }

    return new Response(JSON.stringify({ photos: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch place photos', details: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

