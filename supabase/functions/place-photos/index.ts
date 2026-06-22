// Edge Function: place-photos
//
// Fetches venue/location photos for free from Wikimedia (Wikipedia + Wikimedia
// Commons). No API key and no billing — replaces the previous paid Google Places
// Photo Media API. Results are cached persistently so each venue is fetched once.
//
// Strategy:
//   1. Wikipedia article lead images matching the text query (es, then en).
//   2. Wikimedia Commons geosearch around the coordinates (when provided).
// Image URLs are fetched server-side and returned as base64 data URLs so they
// can be embedded directly into PDFs (no CORS / hotlinking concerns).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCachedPayload, setCachedPayload } from '../_shared/placeCache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Wikimedia requires a descriptive User-Agent identifying the application.
const WIKIMEDIA_USER_AGENT =
  'SectorPro-HojaDeRuta/1.0 (https://sector-pro.work; tecnico@sector-pro.work)'

// Photos for a given venue rarely change, so cache aggressively (180 days).
const PHOTO_CACHE_TTL_SECONDS = 180 * 24 * 60 * 60

interface PhotoRequest {
  query?: string
  lat?: number
  lng?: number
  maxPhotos?: number
  maxWidthPx?: number
  maxHeightPx?: number
}

async function wikipediaImageUrls(
  query: string,
  size: number,
  limit: number,
): Promise<string[]> {
  const urls: string[] = []
  for (const lang of ['es', 'en']) {
    if (urls.length >= limit) break
    try {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: String(limit + 2),
        gsrnamespace: '0',
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: String(size),
        pilimit: String(limit + 2),
      })
      const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params.toString()}`, {
        headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      const pages = data?.query?.pages ? Object.values(data.query.pages) : []
      for (const page of pages as any[]) {
        const source = page?.thumbnail?.source
        if (source && !urls.includes(source)) urls.push(source)
      }
    } catch (err) {
      console.warn(`place-photos: Wikipedia (${lang}) lookup failed:`, err)
    }
  }
  return urls
}

async function commonsGeosearchUrls(
  lat: number,
  lng: number,
  size: number,
  limit: number,
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'geosearch',
      ggscoord: `${lat}|${lng}`,
      ggsradius: '1000',
      ggslimit: String(limit + 4),
      ggsnamespace: '6',
      prop: 'imageinfo',
      iiprop: 'url|mediatype',
      iiurlwidth: String(size),
    })
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const pages = data?.query?.pages ? Object.values(data.query.pages) : []
    const urls: string[] = []
    for (const page of pages as any[]) {
      const info = page?.imageinfo?.[0]
      if (info?.mediatype && info.mediatype !== 'BITMAP') continue
      const url = info?.thumburl || info?.url
      if (url && !urls.includes(url)) urls.push(url)
    }
    return urls
  } catch (err) {
    console.warn('place-photos: Commons geosearch failed:', err)
    return []
  }
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } })
    if (!res.ok) return null
    const blob = await res.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const type = blob.type || 'image/jpeg'
    return `data:${type};base64,${base64}`
  } catch (err) {
    console.warn('place-photos: failed to fetch image:', err)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { query, lat, lng, maxPhotos = 2, maxWidthPx = 500 }: PhotoRequest = await req.json()

    if (!query && (typeof lat !== 'number' || typeof lng !== 'number')) {
      return new Response(
        JSON.stringify({ error: 'A query or coordinates are required', photos: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const size = Math.min(Math.max(Math.floor(maxWidthPx), 100), 1024)
    const limit = Math.min(Math.max(Math.floor(maxPhotos), 1), 5)

    const cacheKey = `photos::wikimedia::${(query || '').trim().toLowerCase()}::${
      typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(4)},${lng.toFixed(4)}` : 'noloc'
    }::${limit}::${size}`

    const cached = await getCachedPayload<{ photos: string[] }>(supabase, cacheKey)
    if (cached?.photos) {
      return new Response(
        JSON.stringify({ photos: cached.photos, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 1) Wikipedia article images for the text query
    const candidateUrls: string[] = []
    if (query) {
      candidateUrls.push(...(await wikipediaImageUrls(query, size, limit)))
    }

    // 2) Commons geosearch fallback when we still need more and have coordinates
    if (candidateUrls.length < limit && typeof lat === 'number' && typeof lng === 'number') {
      for (const url of await commonsGeosearchUrls(lat, lng, size, limit)) {
        if (!candidateUrls.includes(url)) candidateUrls.push(url)
      }
    }

    const selected = candidateUrls.slice(0, limit)
    const results = await Promise.all(selected.map((url) => toDataUrl(url)))
    const validPhotos = results.filter((photo): photo is string => photo !== null)

    // Cache even empty results so we don't repeatedly hit Wikimedia for venues without photos
    await setCachedPayload(supabase, cacheKey, 'photos', { photos: validPhotos }, PHOTO_CACHE_TTL_SECONDS)

    console.log(`place-photos: returning ${validPhotos.length} photo(s) for "${query ?? `${lat},${lng}`}"`)

    return new Response(
      JSON.stringify({ photos: validPhotos }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('place-photos: Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', photos: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
