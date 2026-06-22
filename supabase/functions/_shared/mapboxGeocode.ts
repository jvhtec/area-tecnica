// Server-side Mapbox forward geocoding helper.
//
// Used to resolve an address to coordinates without spending a Google Geocoding
// call. Requires the MAPBOX_PUBLIC_TOKEN secret (already configured for the
// get-mapbox-token function).

export async function mapboxGeocode(
  address: string,
  token: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      access_token: token,
      limit: "1",
      language: "es",
    });

    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (
      !Array.isArray(coords) ||
      typeof coords[0] !== "number" ||
      typeof coords[1] !== "number"
    ) {
      return null;
    }

    return { lat: coords[1], lng: coords[0] };
  } catch (err) {
    console.warn("mapboxGeocode failed:", err);
    return null;
  }
}
