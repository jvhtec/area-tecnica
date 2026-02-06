import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Google Maps API key from secrets
    const { data: secretData, error: secretError } = await supabase.functions.invoke('get-secret', {
      body: { secretName: 'GOOGLE_MAPS_API_KEY' },
    });

    if (secretError || !secretData?.GOOGLE_MAPS_API_KEY) {
      console.error('Failed to get Google Maps API key:', secretError);
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const apiKey = secretData.GOOGLE_MAPS_API_KEY;
    const { query, maxPhotos = 2, maxWidthPx = 400, maxHeightPx = 300 } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🗺️ place-photos: Fetching photos for query:', query);

    // Search for places using Google Places API
    const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.photos'
      },
      body: JSON.stringify({ 
        textQuery: query, 
        maxResultCount: 1 
      })
    });

    if (!searchResponse.ok) {
      console.error('🗺️ place-photos: Places search failed:', searchResponse.status, searchResponse.statusText);
      return new Response(
        JSON.stringify({ photos: [] }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const searchData = await searchResponse.json();
    const place = searchData?.places?.[0];
    const photos = place?.photos || [];

    if (!photos.length) {
      console.log('🗺️ place-photos: No photos found for query:', query);
      return new Response(
        JSON.stringify({ photos: [] }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🗺️ place-photos: Found ${photos.length} photos, fetching up to ${maxPhotos}`);

    // Fetch photo media
    const photoPromises = photos.slice(0, maxPhotos).map(async (photo: any) => {
      const photoName = photo?.name;
      if (!photoName) return null;

      try {
        const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}`;
        const mediaResponse = await fetch(mediaUrl, {
          headers: { 'X-Goog-Api-Key': apiKey }
        });

        if (!mediaResponse.ok) return null;

        const blob = await mediaResponse.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const dataUrl = `data:${blob.type};base64,${base64}`;
        
        return dataUrl;
      } catch (error) {
        console.error('🗺️ place-photos: Error fetching photo:', error);
        return null;
      }
    });

    const results = await Promise.all(photoPromises);
    const validPhotos = results.filter(photo => photo !== null);

    console.log(`🗺️ place-photos: Successfully fetched ${validPhotos.length} photos for query: ${query}`);

    return new Response(
      JSON.stringify({ photos: validPhotos }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('🗺️ place-photos: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', photos: [] }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
