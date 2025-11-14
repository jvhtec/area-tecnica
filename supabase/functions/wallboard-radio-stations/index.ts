import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// In-memory cache for radio stations
let cachedStations: any[] | null = null;
let lastFetch = 0;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
}

interface RadioStation {
  name: string;
  stream: string;
  favicon: string;
  tags: string[];
}

async function fetchSpanishStations(): Promise<RadioStation[]> {
  const now = Date.now();

  // Return cached data if still fresh
  if (cachedStations && (now - lastFetch) < CACHE_DURATION_MS) {
    console.log("Returning cached stations");
    return cachedStations;
  }

  console.log("Fetching fresh stations from Radio Browser API");

  // Fetch from Radio Browser API
  const apiUrl = "https://de1.api.radio-browser.info/json/stations/search?countrycode=ES&order=clickcount&reverse=true&limit=200";

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "wallboard-system/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Radio Browser API error: ${response.status} ${response.statusText}`);
  }

  const rawStations = await response.json();

  // Transform to our format
  cachedStations = rawStations
    .filter((s: any) => s.url_resolved) // Only stations with valid stream URL
    .map((s: any) => ({
      name: s.name || "Unknown Station",
      stream: s.url_resolved,
      favicon: s.favicon || "",
      tags: s.tags ? s.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    }));

  lastFetch = now;
  console.log(`Cached ${cachedStations.length} stations`);

  return cachedStations;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("search")?.toLowerCase() || "";
    const tagFilter = url.searchParams.get("tag")?.toLowerCase() || "";

    // Fetch stations (from cache or API)
    let stations = await fetchSpanishStations();

    // Apply filters
    if (searchQuery) {
      stations = stations.filter((s) =>
        s.name.toLowerCase().includes(searchQuery)
      );
    }

    if (tagFilter) {
      stations = stations.filter((s) =>
        s.tags.some((t) => t.toLowerCase().includes(tagFilter))
      );
    }

    return new Response(JSON.stringify(stations), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching radio stations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
